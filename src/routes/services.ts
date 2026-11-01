import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";

export type ServiceStatus = "running" | "stopped" | "unhealthy" | "unknown";
export type IntegrationHealth = "available" | "unavailable";

export interface DockerClient {
  getContainerStatus(containerId: string): Promise<ServiceStatus>;
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
}
