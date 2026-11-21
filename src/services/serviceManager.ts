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
import type { OperationAction } from "../interfaces/operation.ts";
import type { UptimeKumaMonitor } from "../interfaces/uptimeKuma.ts";
import type { UptimeKumaService } from "./uptimeKumaService.ts";
import type { N8nService } from "./n8nService.ts";
import type { ControlCenterRepository } from "../interfaces/repository.ts";

export interface ServicesListResult {
  summary: {
    total: number;
    online: number;
    unhealthy: number;
  };
  integrationStatus: {
    docker: IntegrationHealth;
    uptimeKuma?: IntegrationHealth;
    n8n?: IntegrationHealth;
  };
  services: (Service & {
    status: ServiceStatus;
    lastCheckedAt: string;
    consecutiveFailures?: number;
    healthCheck?: HealthCheckResult;
    uptimeKumaMonitor?: UptimeKumaMonitor;
  })[];
}

export interface ServiceDetailResult extends Service {
  status: ServiceStatus;
  metrics: ContainerMetrics;
  healthCheck?: HealthCheckResult;
  uptimeKumaMonitor?: UptimeKumaMonitor;
}

export function redactLogMessage(message: string): string {
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
  private uptimeKumaService?: UptimeKumaService;
  private n8nService?: N8nService;
  private repository?: ControlCenterRepository;

  constructor(
    options: {
      dockerClient?: DockerClient;
      initialServices?: Service[];
      repository?: ControlCenterRepository;
    } = {}
  ) {
    this.dockerClient = options.dockerClient;
    this.repository = options.repository;
    if (options.initialServices) {
      if (this.repository) {
        for (const srv of options.initialServices) {
          if (!this.repository.getServiceById(srv.id)) {
            this.repository.saveService(srv);
          }
        }
      } else {
        this.services = [...options.initialServices];
      }
    }
  }

  private getServiceRecord(id: string): Service | undefined {
    if (this.repository) {
      return this.repository.getServiceById(id) ?? undefined;
    }
    return this.services.find((s) => s.id === id);
  }

  private getHealthChecksForService(serviceId: string, limit?: number): HealthCheckResult[] {
    if (this.repository) {
      return this.repository.getHealthChecks(serviceId, limit);
    }
    const list = this.healthChecks.get(serviceId) || [];
    return limit !== undefined ? list.slice(-limit) : list;
  }

  setUptimeKumaService(uptimeKumaService: UptimeKumaService): void {
    this.uptimeKumaService = uptimeKumaService;
  }

  setN8nService(n8nService: N8nService): void {
    this.n8nService = n8nService;
  }

  async register(data: {
    name: string;
    externalId: string;
    integration: string;
    allowedActions?: OperationAction[];
  }): Promise<Service> {
    const newService: Service = {
      id: crypto.randomUUID(),
      name: data.name,
      externalId: data.externalId,
      integration: data.integration,
      allowedActions: data.allowedActions,
      createdAt: new Date().toISOString(),
    };
    if (this.repository) {
      this.repository.saveService(newService);
    } else {
      this.services.push(newService);
    }
    return newService;
  }

  async list(): Promise<ServicesListResult> {
    let online = 0;
    let unhealthy = 0;
    let dockerStatus: IntegrationHealth = "available";
    let ukMonitors: UptimeKumaMonitor[] = [];
    let uptimeKumaStatus: IntegrationHealth | undefined;
    if (this.uptimeKumaService?.hasClient()) {
      const ukResult = await this.uptimeKumaService.listMonitors();
      ukMonitors = ukResult.monitors;
      uptimeKumaStatus = ukResult.integrationStatus;
    }
    let n8nStatus: IntegrationHealth | undefined;
    if (this.n8nService?.hasClient()) {
      const n8nResult = await this.n8nService.listWorkflows();
      n8nStatus = n8nResult.integrationStatus;
    }

    const allServices = this.repository ? this.repository.listServices() : this.services;

    const enrichedServices = await Promise.all(
      allServices.map(async (service) => {
        let status: ServiceStatus = "unknown";
        if (this.dockerClient && service.integration === "docker") {
          try {
            status = await this.dockerClient.getContainerStatus(service.externalId);
          } catch {
            dockerStatus = "unavailable";
            status = "unknown";
          }
        }

        const checks = this.getHealthChecksForService(service.id);
        let consecutiveFailures = 0;
        for (let i = checks.length - 1; i >= 0; i--) {
          if (checks[i].status === "unhealthy") {
            consecutiveFailures++;
          } else {
            break;
          }
        }

        if (consecutiveFailures > 0 && status === "running") {
          status = "unhealthy";
        }

        if (status === "running") online++;
        if (status === "unhealthy") unhealthy++;

        return {
          ...service,
          status,
          consecutiveFailures,
          healthCheck: checks.slice(-1)[0],
          uptimeKumaMonitor: ukMonitors.find((m) => m.serviceId === service.id),
          lastCheckedAt: new Date().toISOString(),
        };
      })
    );

    return {
      summary: {
        total: allServices.length,
        online,
        unhealthy,
      },
      integrationStatus: {
        docker: dockerStatus,
        ...(uptimeKumaStatus ? { uptimeKuma: uptimeKumaStatus } : {}),
        ...(n8nStatus ? { n8n: n8nStatus } : {}),
      },
      services: enrichedServices,
    };
  }

  async getById(id: string): Promise<ServiceDetailResult | null> {
    const service = this.getServiceRecord(id);
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

    const uptimeKumaMonitor = this.uptimeKumaService
      ? await this.uptimeKumaService.getMonitorForService(service.id)
      : undefined;

    return {
      ...service,
      status,
      metrics,
      healthCheck: this.getHealthChecksForService(service.id, 1)[0],
      uptimeKumaMonitor,
    };
  }

  async runHealthCheck(id: string): Promise<HealthCheckResult | null> {
    const service = this.getServiceRecord(id);
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

    if (this.repository) {
      this.repository.addHealthCheck(check);
    } else {
      const history = this.healthChecks.get(service.id) || [];
      history.push(check);
      this.healthChecks.set(service.id, history);
    }

    return check;
  }

  async getHealthCheckHistory(id: string, limit: number = 20): Promise<{ serviceId: string; history: HealthCheckResult[] } | null> {
    const service = this.getServiceRecord(id);
    if (!service) return null;

    return {
      serviceId: service.id,
      history: this.getHealthChecksForService(service.id, limit),
    };
  }

  async getLogs(id: string, options?: LogFilterOptions): Promise<{ serviceId: string; entries: LogEntry[] } | null> {
    const service = this.getServiceRecord(id);
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

  async executeServiceAction(id: string, action: string): Promise<boolean> {
    const service = this.getServiceRecord(id);
    if (!service) return false;

    if (this.dockerClient?.executeContainerAction && service.integration === "docker") {
      await this.dockerClient.executeContainerAction(service.externalId, action);
      return true;
    }
    return true;
  }
}
