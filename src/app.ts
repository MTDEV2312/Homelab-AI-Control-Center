import Fastify from "fastify";
import {
  registerServicesRoutes,
  type DockerClient,
  type Service,
  type ServiceStatus,
  type IntegrationHealth,
} from "./routes/services.js";

export type { DockerClient, Service, ServiceStatus, IntegrationHealth };

export interface AppOptions {
  dockerClient?: DockerClient;
}

export function buildApp(options: AppOptions = {}) {
  const app = Fastify();
  const services: Service[] = [];

  registerServicesRoutes(app, {
    services,
    dockerClient: options.dockerClient,
  });

  return app;
}
