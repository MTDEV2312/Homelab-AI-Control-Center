import Fastify from "fastify";
import { registerServicesRoutes } from "./routes/services.ts";
import type {
  DockerClient,
  Service,
  ServiceStatus,
  IntegrationHealth,
  ContainerMetrics,
} from "./interfaces/service.ts";

export type {
  DockerClient,
  Service,
  ServiceStatus,
  IntegrationHealth,
  ContainerMetrics,
};

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
