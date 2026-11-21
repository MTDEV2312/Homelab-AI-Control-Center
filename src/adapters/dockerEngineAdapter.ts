import http from "node:http";
import https from "node:https";
import type {
  ContainerMetrics,
  DockerClient,
  HealthStatus,
  LogEntry,
  LogFilterOptions,
  LogLevel,
  ServiceStatus,
} from "../interfaces/service.ts";

export interface DockerEngineAdapterOptions {
  baseUrl?: string;
  socketPath?: string;
  timeoutMs?: number;
}

function inferLogLevel(streamType: 1 | 2, message: string): LogLevel {
  if (streamType === 2 || /\b(error|fatal|exception)\b/i.test(message)) {
    return "error";
  }
  if (/\bwarn(ing)?\b/i.test(message)) {
    return "warn";
  }
  return "info";
}

function parseLogLine(streamType: 1 | 2, line: string): LogEntry | null {
  const trimmed = line.replace(/\r$/, "").trimEnd();
  if (!trimmed) {
    return null;
  }

  const tsMatch = /^(\d{4}-\d{2}-\d{2}T\S+)\s+(.*)$/.exec(trimmed);
  if (tsMatch) {
    const [, timestamp, message] = tsMatch;
    return {
      timestamp,
      level: inferLogLevel(streamType, message),
      message,
    };
  }

  return {
    timestamp: new Date().toISOString(),
    level: inferLogLevel(streamType, trimmed),
    message: trimmed,
  };
}

/**
 * Decodes Docker multiplexed stream frames (8-byte header + payload) or plain TTY output.
 */
export function decodeDockerLogs(buffer: Buffer): LogEntry[] {
  if (buffer.length === 0) {
    return [];
  }

  const isMultiplexed =
    buffer.length >= 8 &&
    (buffer[0] === 1 || buffer[0] === 2) &&
    buffer[1] === 0 &&
    buffer[2] === 0 &&
    buffer[3] === 0;

  if (!isMultiplexed) {
    return buffer
      .toString("utf8")
      .split("\n")
      .map((line) => parseLogLine(1, line))
      .filter((entry): entry is LogEntry => entry !== null);
  }

  const entries: LogEntry[] = [];
  let offset = 0;

  while (offset + 8 <= buffer.length) {
    const rawStream = buffer[offset];
    const streamType: 1 | 2 = rawStream === 2 ? 2 : 1;
    const size = buffer.readUInt32BE(offset + 4);
    offset += 8;

    const end = Math.min(offset + size, buffer.length);
    const chunk = buffer.subarray(offset, end).toString("utf8");
    offset = end;

    for (const line of chunk.split("\n")) {
      const parsed = parseLogLine(streamType, line);
      if (parsed) {
        entries.push(parsed);
      }
    }
  }

  return entries;
}

export class DockerEngineAdapter implements DockerClient {
  private baseUrl?: string;
  private socketPath?: string;
  private timeoutMs: number;

  constructor(options: DockerEngineAdapterOptions) {
    this.timeoutMs = options.timeoutMs ?? 5000;

    if (options.socketPath) {
      this.socketPath = options.socketPath;
    } else if (options.baseUrl) {
      const trimmed = options.baseUrl.trim();
      if (trimmed.startsWith("unix://")) {
        this.socketPath = trimmed.slice("unix://".length);
      } else if (trimmed.startsWith("tcp://")) {
        this.baseUrl = `http://${trimmed.slice("tcp://".length).replace(/\/+$/, "")}`;
      } else {
        this.baseUrl = trimmed.replace(/\/+$/, "");
      }
    }

    if (!this.socketPath && !this.baseUrl) {
      throw new Error("DockerEngineAdapter requires either baseUrl or socketPath");
    }
  }

  private request(method: string, path: string): Promise<{ statusCode: number; body: Buffer }> {
    return new Promise((resolve, reject) => {
      const handleResponse = (res: http.IncomingMessage) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 500,
            body: Buffer.concat(chunks),
          });
        });
        res.on("error", reject);
      };

      let req: http.ClientRequest;

      if (this.socketPath) {
        req = http.request(
          { socketPath: this.socketPath, path, method, timeout: this.timeoutMs },
          handleResponse
        );
      } else {
        const url = new URL(path, this.baseUrl);
        const transport = url.protocol === "https:" ? https : http;
        req = transport.request(
          {
            hostname: url.hostname,
            port: url.port || undefined,
            path: `${url.pathname}${url.search}`,
            method,
            timeout: this.timeoutMs,
          },
          handleResponse
        );
      }

      req.on("timeout", () => {
        req.destroy(new Error(`Docker API request timed out after ${this.timeoutMs}ms`));
      });
      req.on("error", reject);
      req.end();
    });
  }

  async getContainerStatus(containerId: string): Promise<ServiceStatus> {
    const res = await this.request("GET", `/containers/${encodeURIComponent(containerId)}/json`);
    if (res.statusCode === 404) {
      return "unknown";
    }
    if (res.statusCode >= 400) {
      throw new Error(`Docker inspect failed with status ${res.statusCode}`);
    }

    const inspect = JSON.parse(res.body.toString("utf8"));
    const state = inspect?.State;
    if (state?.Health?.Status === "unhealthy") {
      return "unhealthy";
    }
    if (state?.Running === true || state?.Status === "running") {
      return "running";
    }
    return "stopped";
  }

  async getContainerMetrics(containerId: string): Promise<Omit<ContainerMetrics, "available">> {
    const encodedId = encodeURIComponent(containerId);
    const [statsRes, inspectRes] = await Promise.all([
      this.request("GET", `/containers/${encodedId}/stats?stream=false`),
      this.request("GET", `/containers/${encodedId}/json`),
    ]);

    if (statsRes.statusCode >= 400) {
      throw new Error(`Docker stats failed with status ${statsRes.statusCode}`);
    }
    if (inspectRes.statusCode >= 400) {
      throw new Error(`Docker inspect failed with status ${inspectRes.statusCode}`);
    }

    const stats = JSON.parse(statsRes.body.toString("utf8"));
    const inspect = JSON.parse(inspectRes.body.toString("utf8"));

    const cpuDelta =
      (stats.cpu_stats?.cpu_usage?.total_usage ?? 0) -
      (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
    const systemDelta =
      (stats.cpu_stats?.system_cpu_usage ?? 0) -
      (stats.precpu_stats?.system_cpu_usage ?? 0);
    const onlineCpus =
      stats.cpu_stats?.online_cpus ||
      stats.cpu_stats?.cpu_usage?.percpu_usage?.length ||
      1;

    const cpuPercent =
      systemDelta > 0 && cpuDelta > 0
        ? Math.round(((cpuDelta / systemDelta) * onlineCpus * 100) * 100) / 100
        : 0;

    const usage = stats.memory_stats?.usage ?? 0;
    const cache =
      stats.memory_stats?.stats?.cache ?? stats.memory_stats?.stats?.inactive_file ?? 0;
    const memoryUsedBytes = Math.max(0, usage - cache);
    const memoryLimitBytes = stats.memory_stats?.limit ?? 0;

    const startedAtMs = inspect?.State?.StartedAt ? Date.parse(inspect.State.StartedAt) : NaN;
    const uptimeSeconds = !Number.isNaN(startedAtMs)
      ? Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
      : undefined;

    return {
      cpuPercent,
      memoryUsedBytes,
      memoryLimitBytes,
      uptimeSeconds,
    };
  }

  async getContainerLogs(containerId: string, options?: LogFilterOptions): Promise<LogEntry[]> {
    const params = new URLSearchParams({
      stdout: "true",
      stderr: "true",
      timestamps: "true",
    });

    const tail =
      !options?.query && !options?.level && options?.limit && options.limit > 0
        ? String(options.limit)
        : "200";
    params.set("tail", tail);

    if (options?.since) {
      const sinceMs = Date.parse(options.since);
      if (!Number.isNaN(sinceMs)) {
        params.set("since", String(Math.floor(sinceMs / 1000)));
      }
    }

    const res = await this.request(
      "GET",
      `/containers/${encodeURIComponent(containerId)}/logs?${params.toString()}`
    );
    if (res.statusCode >= 400) {
      throw new Error(`Docker logs failed with status ${res.statusCode}`);
    }

    return decodeDockerLogs(res.body);
  }

  async checkHealth(
    containerId: string
  ): Promise<{ status: HealthStatus; latencyMs: number; errorCode?: string }> {
    const start = Date.now();
    const res = await this.request("GET", `/containers/${encodeURIComponent(containerId)}/json`);
    const latencyMs = Date.now() - start;

    if (res.statusCode === 404) {
      return { status: "unhealthy", latencyMs, errorCode: "CONTAINER_NOT_FOUND" };
    }
    if (res.statusCode >= 400) {
      return { status: "unhealthy", latencyMs, errorCode: `HTTP_${res.statusCode}` };
    }

    const inspect = JSON.parse(res.body.toString("utf8"));
    const state = inspect?.State;

    if (state?.Health?.Status === "unhealthy") {
      return { status: "unhealthy", latencyMs, errorCode: "CONTAINER_UNHEALTHY" };
    }
    if (state?.Running === true || state?.Status === "running") {
      return { status: "healthy", latencyMs };
    }

    const rawStatus = String(state?.Status || "STOPPED").toUpperCase();
    return { status: "unhealthy", latencyMs, errorCode: `STATE_${rawStatus}` };
  }

  async executeContainerAction(containerId: string, action: string): Promise<void> {
    if (!["start", "stop", "restart"].includes(action)) {
      throw new Error(`Unsupported Docker container action: ${action}`);
    }

    const res = await this.request(
      "POST",
      `/containers/${encodeURIComponent(containerId)}/${action}`
    );
    if (res.statusCode !== 204 && res.statusCode !== 304) {
      throw new Error(`Docker action ${action} failed with status ${res.statusCode}`);
    }
  }
}
