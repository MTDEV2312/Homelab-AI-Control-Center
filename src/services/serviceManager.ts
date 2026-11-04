import crypto from "node:crypto";
import type {
  Service,
  ServiceStatus,
  IntegrationHealth,
  ContainerMetrics,
  DockerClient,
  LogEntry,
  LogFilterOptions,
  HealthStatus,
  HealthCheckResult,
} from "../interfaces/service.ts";

export interface ServicesListResult {
  summary: {
    total: number;
    online: number;
    unhealthy: number;
  };
  integrationStatus: {
    docker: IntegrationHealth;
  };
  services: (Service & {
    status: ServiceStatus;
    lastCheckedAt: string;
  })[];
}

export interface ServiceDetailResult extends Service {
  status: ServiceStatus;
  metrics: ContainerMetrics;
  healthCheck?: HealthCheckResult;
}

function redactLogMessage(message: string): string {
  return message
    .replace(/(Bearer\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(/(password=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(api_key=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(token=)[^&\s]+/gi, "$1[REDACTED]");
}

export class ServiceManager {
  private services: Service[] = [];
  private dockerClient?: DockerClient;
  private healthChecks: Map<string, HealthCheckResult[]> = new Map();

  constructor(options: { dockerClient?: DockerClient; initialServices?: Service[] } = {}) {
    this.dockerClient = options.dockerClient;
    if (options.initialServices) {
      this.services = [...options.initialServices];
    }
  }

  async register(data: { name: string; externalId: string; integration: string }): Promise<Service> {
    const newService: Service = {
      id: crypto.randomUUID(),
      name: data.name,
      externalId: data.externalId,
      integration: data.integration,
      createdAt: new Date().toISOString(),
    };
    this.services.push(newService);
    return newService;
  }

  async list(): Promise<ServicesListResult> {
    let online = 0;
    let unhealthy = 0;
    let dockerStatus: IntegrationHealth = "available";

    const enrichedServices = await Promise.all(
      this.services.map(async (service) => {
        let status: ServiceStatus = "unknown";
        if (this.dockerClient && service.integration === "docker") {
          try {
            status = await this.dockerClient.getContainerStatus(service.externalId);
          } catch {
            dockerStatus = "unavailable";
            status = "unknown";
          }
        }

        if (status === "running") online++;
        if (status === "unhealthy") unhealthy++;

        return {
          ...service,
          status,
          lastCheckedAt: new Date().toISOString(),
        };
      })
    );

    return {
      summary: {
        total: this.services.length,
        online,
        unhealthy,
      },
      integrationStatus: {
        docker: dockerStatus,
      },
      services: enrichedServices,
    };
  }

  async getById(id: string): Promise<ServiceDetailResult | null> {
    const service = this.services.find((s) => s.id === id);
    if (!service) return null;

    let status: ServiceStatus = "unknown";
    let metrics: ContainerMetrics = {
      available: false,
      reason: "Container is not running",
    };

    if (this.dockerClient && service.integration === "docker") {
      try {
        status = await this.dockerClient.getContainerStatus(service.externalId);
        if (status === "running" && this.dockerClient.getContainerMetrics) {
          const rawMetrics = await this.dockerClient.getContainerMetrics(service.externalId);
          metrics = {
            available: true,
            ...rawMetrics,
          };
        } else if (status !== "running") {
          metrics = {
            available: false,
            reason: "Container is not running",
          };
        }
      } catch {
        status = "unknown";
        metrics = {
          available: false,
          reason: "Docker unreachable",
        };
      }
    }

    return {
      ...service,
      status,
      metrics,
      healthCheck: this.healthChecks.get(service.id)?.slice(-1)[0],
    };
  }

  async runHealthCheck(id: string): Promise<HealthCheckResult | null> {
    const service = this.services.find((s) => s.id === id);
    if (!service) return null;

    let status: HealthStatus = "healthy";
    let latencyMs = 0;
    let errorCode: string | undefined;

    if (this.dockerClient?.checkHealth && service.integration === "docker") {
      try {
        const res = await this.dockerClient.checkHealth(service.externalId);
        status = res.status;
        latencyMs = res.latencyMs;
        errorCode = res.errorCode;
      } catch (err: any) {
        status = "unhealthy";
        errorCode = err?.message || "CHECK_FAILED";
      }
    }

    const check: HealthCheckResult = {
      id: crypto.randomUUID(),
      serviceId: service.id,
      status,
      latencyMs,
      checkedAt: new Date().toISOString(),
      errorCode,
    };

    const history = this.healthChecks.get(service.id) || [];
    history.push(check);
    this.healthChecks.set(service.id, history);

    return check;
  }

  async getHealthCheckHistory(id: string, limit: number = 20): Promise<{ serviceId: string; history: HealthCheckResult[] } | null> {
    const service = this.services.find((s) => s.id === id);
    if (!service) return null;

    const history = (this.healthChecks.get(service.id) || []).slice(-limit);
    return {
      serviceId: service.id,
      history,
    };
  }

  async getLogs(id: string, options?: LogFilterOptions): Promise<{ serviceId: string; entries: LogEntry[] } | null> {
    const service = this.services.find((s) => s.id === id);
    if (!service) return null;

    let entries: LogEntry[] = [];
    if (this.dockerClient?.getContainerLogs && service.integration === "docker") {
      try {
        entries = await this.dockerClient.getContainerLogs(service.externalId, options);
      } catch {
        entries = [];
      }
    }

    if (options) {
      if (options.level) {
        entries = entries.filter((e) => e.level === options.level);
      }
      if (options.query) {
        const q = options.query.toLowerCase();
        entries = entries.filter((e) => e.message.toLowerCase().includes(q));
      }
      if (options.since) {
        const sinceTime = new Date(options.since).getTime();
        entries = entries.filter((e) => new Date(e.timestamp).getTime() >= sinceTime);
      }
      if (options.limit !== undefined) {
        const lim = Number(options.limit);
        if (!isNaN(lim) && lim > 0) {
          entries = entries.slice(0, lim);
        }
      }
    }

    entries = entries.map((entry) => ({
      ...entry,
      message: redactLogMessage(entry.message),
    }));

    return {
      serviceId: service.id,
      entries,
    };
  }
}
