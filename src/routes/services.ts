import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";

export type ServiceStatus = "running" | "stopped" | "unhealthy" | "unknown";
export type IntegrationHealth = "available" | "unavailable";

export interface ContainerMetrics {
  available: boolean;
  cpuPercent?: number;
  memoryUsedBytes?: number;
  memoryLimitBytes?: number;
  uptimeSeconds?: number;
}

export interface DockerClient {
  getContainerStatus(containerId: string): Promise<ServiceStatus>;
  getContainerMetrics?(containerId: string): Promise<Omit<ContainerMetrics, "available">>;
}

export interface Service {
  id: string;
  name: string;
  externalId: string;
  integration: string;
  createdAt: string;
}

export interface ServicesRouteOptions {
  services: Service[];
  dockerClient?: DockerClient;
}

export async function registerServicesRoutes(
  app: FastifyInstance,
  options: ServicesRouteOptions
) {
  const { services, dockerClient } = options;

  app.post<{
    Body: { name: string; externalId: string; integration: string };
  }>("/api/services", async (request, reply) => {
    const { name, externalId, integration } = request.body;

    const newService: Service = {
      id: crypto.randomUUID(),
      name,
      externalId,
      integration,
      createdAt: new Date().toISOString(),
    };

    services.push(newService);
    return reply.status(201).send(newService);
  });

  app.get("/api/services", async () => {
    let online = 0;
    let unhealthy = 0;
    let dockerStatus: IntegrationHealth = "available";

    const enrichedServices = await Promise.all(
      services.map(async (service) => {
        let status: ServiceStatus = "unknown";
        if (dockerClient && service.integration === "docker") {
          try {
            status = await dockerClient.getContainerStatus(service.externalId);
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
        total: services.length,
        online,
        unhealthy,
      },
      integrationStatus: {
        docker: dockerStatus,
      },
      services: enrichedServices,
    };
  });

  app.get<{ Params: { id: string } }>("/api/services/:id", async (request, reply) => {
    const { id } = request.params;
    const service = services.find((s) => s.id === id);
    if (!service) {
      return reply.status(404).send({ message: "Service not found" });
    }

    let status: ServiceStatus = "unknown";
    let metrics: ContainerMetrics = { available: false };

    if (dockerClient && service.integration === "docker") {
      try {
        status = await dockerClient.getContainerStatus(service.externalId);
        if (status === "running" && dockerClient.getContainerMetrics) {
          const rawMetrics = await dockerClient.getContainerMetrics(service.externalId);
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
  });
}
