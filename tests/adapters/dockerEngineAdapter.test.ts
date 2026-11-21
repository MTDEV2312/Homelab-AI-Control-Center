import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it, expect, afterEach } from "vitest";
import { DockerEngineAdapter } from "../../src/adapters/dockerEngineAdapter.ts";
import { createAdaptersFromEnv } from "../../src/config/env.ts";

function frameDockerLog(streamType: 1 | 2, text: string): Buffer {
  const payload = Buffer.from(text, "utf8");
  const header = Buffer.alloc(8);
  header[0] = streamType;
  header.writeUInt32BE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

describe("DockerEngineAdapter", () => {
  let activeServer: http.Server | null = null;

  afterEach(async () => {
    if (activeServer) {
      await new Promise<void>((resolve) => activeServer!.close(() => resolve()));
      activeServer = null;
    }
  });

  async function startMockDockerServer(
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
  ): Promise<string> {
    activeServer = http.createServer(handler);
    await new Promise<void>((resolve) => {
      activeServer!.listen(0, "localhost", () => resolve());
    });
    const addr = activeServer.address() as AddressInfo;
    return `http://localhost:${addr.port}`;
  }

  it("maps container inspect states to running, unhealthy, stopped, unknown (404), and throws on daemon error (500)", async () => {
    const baseUrl = await startMockDockerServer((req, res) => {
      if (req.url === "/containers/running-ctr/json") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            State: { Running: true, Status: "running", Health: { Status: "healthy" } },
          })
        );
        return;
      }
      if (req.url === "/containers/unhealthy-ctr/json") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            State: { Running: true, Status: "running", Health: { Status: "unhealthy" } },
          })
        );
        return;
      }
      if (req.url === "/containers/stopped-ctr/json") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            State: { Running: false, Status: "exited" },
          })
        );
        return;
      }
      if (req.url === "/containers/missing-ctr/json") {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "No such container" }));
        return;
      }
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Internal daemon error" }));
    });

    const adapter = new DockerEngineAdapter({ baseUrl });

    expect(await adapter.getContainerStatus("running-ctr")).toBe("running");
    expect(await adapter.getContainerStatus("unhealthy-ctr")).toBe("unhealthy");
    expect(await adapter.getContainerStatus("stopped-ctr")).toBe("stopped");
    expect(await adapter.getContainerStatus("missing-ctr")).toBe("unknown");
    await expect(adapter.getContainerStatus("error-ctr")).rejects.toThrow(/500/);
  });

  it("computes CPU percentage, memory usage excluding cache, limit, and uptime from container stats and inspect", async () => {
    const startedAt = new Date(Date.now() - 120_000).toISOString();

    const baseUrl = await startMockDockerServer((req, res) => {
      if (req.url === "/containers/jellyfin/stats?stream=false") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            cpu_stats: {
              cpu_usage: { total_usage: 2_000_000_000 },
              system_cpu_usage: 20_000_000_000,
              online_cpus: 2,
            },
            precpu_stats: {
              cpu_usage: { total_usage: 1_000_000_000 },
              system_cpu_usage: 10_000_000_000,
            },
            memory_stats: {
              usage: 600_000_000,
              limit: 2_000_000_000,
              stats: { cache: 100_000_000 },
            },
          })
        );
        return;
      }
      if (req.url === "/containers/jellyfin/json") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            State: { Running: true, Status: "running", StartedAt: startedAt },
          })
        );
        return;
      }
      res.writeHead(404).end();
    });

    const adapter = new DockerEngineAdapter({ baseUrl });
    const metrics = await adapter.getContainerMetrics("jellyfin");

    expect(metrics.cpuPercent).toBe(20);
    expect(metrics.memoryUsedBytes).toBe(500_000_000);
    expect(metrics.memoryLimitBytes).toBe(2_000_000_000);
    expect(metrics.uptimeSeconds).toBeGreaterThanOrEqual(119);
    expect(metrics.uptimeSeconds).toBeLessThanOrEqual(125);
  });

  it("decodes multiplexed Docker stdout/stderr log frames and parses timestamps and log levels", async () => {
    let requestedUrl = "";
    const frame1 = frameDockerLog(1, "2026-11-20T19:00:00.000Z Server started listening\n");
    const frame2 = frameDockerLog(
      1,
      "2026-11-20T19:01:00.000Z WARN cache approaching capacity\n"
    );
    const frame3 = frameDockerLog(
      2,
      "2026-11-20T19:02:00.000Z Fatal exception connecting to db\n"
    );
    const bodyBuffer = Buffer.concat([frame1, frame2, frame3]);

    const baseUrl = await startMockDockerServer((req, res) => {
      requestedUrl = req.url || "";
      res.writeHead(200, { "Content-Type": "application/vnd.docker.multiplexed-stream" });
      res.end(bodyBuffer);
    });

    const adapter = new DockerEngineAdapter({ baseUrl });
    const entries = await adapter.getContainerLogs("jellyfin", {
      limit: 50,
      since: "2026-11-20T18:55:00.000Z",
    });

    expect(requestedUrl).toContain("/containers/jellyfin/logs?");
    expect(requestedUrl).toContain("tail=50");
    expect(requestedUrl).toContain("since=");
    expect(entries).toEqual([
      {
        timestamp: "2026-11-20T19:00:00.000Z",
        level: "info",
        message: "Server started listening",
      },
      {
        timestamp: "2026-11-20T19:01:00.000Z",
        level: "warn",
        message: "WARN cache approaching capacity",
      },
      {
        timestamp: "2026-11-20T19:02:00.000Z",
        level: "error",
        message: "Fatal exception connecting to db",
      },
    ]);
  });

  it("checkHealth reports healthy/unhealthy with latency and error codes", async () => {
    const baseUrl = await startMockDockerServer((req, res) => {
      if (req.url === "/containers/ok-ctr/json") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ State: { Running: true, Status: "running" } }));
        return;
      }
      if (req.url === "/containers/sick-ctr/json") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            State: { Running: true, Status: "running", Health: { Status: "unhealthy" } },
          })
        );
        return;
      }
      res.writeHead(404).end();
    });

    const adapter = new DockerEngineAdapter({ baseUrl });

    const okHealth = await adapter.checkHealth("ok-ctr");
    expect(okHealth.status).toBe("healthy");
    expect(okHealth.latencyMs).toBeGreaterThanOrEqual(0);
    expect(okHealth.errorCode).toBeUndefined();

    const sickHealth = await adapter.checkHealth("sick-ctr");
    expect(sickHealth.status).toBe("unhealthy");
    expect(sickHealth.errorCode).toBe("CONTAINER_UNHEALTHY");

    const missingHealth = await adapter.checkHealth("missing-ctr");
    expect(missingHealth.status).toBe("unhealthy");
    expect(missingHealth.errorCode).toBe("CONTAINER_NOT_FOUND");
  });

  it("executeContainerAction posts start/stop/restart accepting 204/304 and rejects unsupported actions", async () => {
    const calls: { method?: string; url?: string }[] = [];

    const baseUrl = await startMockDockerServer((req, res) => {
      calls.push({ method: req.method, url: req.url });
      if (req.url === "/containers/vw/restart") {
        res.writeHead(204).end();
        return;
      }
      if (req.url === "/containers/vw/start") {
        res.writeHead(304).end();
        return;
      }
      res.writeHead(404).end();
    });

    const adapter = new DockerEngineAdapter({ baseUrl });

    await adapter.executeContainerAction("vw", "restart");
    await adapter.executeContainerAction("vw", "start");

    expect(calls).toEqual([
      { method: "POST", url: "/containers/vw/restart" },
      { method: "POST", url: "/containers/vw/start" },
    ]);

    await expect(adapter.executeContainerAction("vw", "remove")).rejects.toThrow(/Unsupported/);
    await expect(adapter.executeContainerAction("vw", "stop")).rejects.toThrow(/404/);
  });

  it("createAdaptersFromEnv wires DockerEngineAdapter when DOCKER_HOST or DOCKER_SOCKET_PATH is configured and omits it when unset", () => {
    expect(createAdaptersFromEnv({})).toEqual({});
    expect(
      createAdaptersFromEnv({
        DOCKER_HOST: "your_docker_proxy_url_here",
        DOCKER_SOCKET_PATH: "your_docker_socket_path_here",
      })
    ).toEqual({});

    const withHost = createAdaptersFromEnv({ DOCKER_HOST: "http://localhost:2375" });
    expect(withHost.dockerClient).toBeInstanceOf(DockerEngineAdapter);

    const withSocket = createAdaptersFromEnv({ DOCKER_SOCKET_PATH: "/var/run/docker.sock" });
    expect(withSocket.dockerClient).toBeInstanceOf(DockerEngineAdapter);
  });
});
