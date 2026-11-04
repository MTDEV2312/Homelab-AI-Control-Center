import Fastify from "fastify";
import { registerServicesRoutes } from "./routes/services.ts";
import { registerToolsRoutes } from "./routes/tools.ts";
import { ServiceManager } from "./services/serviceManager.ts";
import { ToolService } from "./services/toolService.ts";
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
  toolService?: ToolService;
}

export function buildApp(options: AppOptions = {}) {
  const app = Fastify();
  const serviceManager =
    options.serviceManager ??
    new ServiceManager({ dockerClient: options.dockerClient });
  const toolService =
    options.toolService ?? new ToolService(serviceManager);

  registerServicesRoutes(app, { serviceManager });
  registerToolsRoutes(app, { toolService });

  return app;
}
