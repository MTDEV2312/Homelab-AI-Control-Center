import crypto from "node:crypto";
import type {
  Service,
  ServiceStatus,
  IntegrationHealth,
  ContainerMetrics,
  DockerClient,
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
}

export class ServiceManager {
  private services: Service[] = [];
  private dockerClient?: DockerClient;

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
    let metrics: ContainerMetrics = { available: false };

    if (this.dockerClient && service.integration === "docker") {
      try {
        status = await this.dockerClient.getContainerStatus(service.externalId);
        if (status === "running" && this.dockerClient.getContainerMetrics) {
          const rawMetrics = await this.dockerClient.getContainerMetrics(service.externalId);
          metrics = {
            available: true,
            ...rawMetrics,
          };
        }
      } catch {
        status = "unknown";
        metrics = { available: false };
      }
    }

    return {
      ...service,
      status,
      metrics,
    };
  }
}
