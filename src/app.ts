import Fastify from "fastify";
import { registerServicesRoutes } from "./routes/services.ts";
import { ServiceManager } from "./services/serviceManager.ts";
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
  serviceManager?: ServiceManager;
}

export function buildApp(options: AppOptions = {}) {
  const app = Fastify();
  const serviceManager =
    options.serviceManager ??
    new ServiceManager({ dockerClient: options.dockerClient });

  registerServicesRoutes(app, { serviceManager });

  return app;
}
