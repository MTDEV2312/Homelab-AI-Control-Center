import Fastify from "fastify";
import { registerServicesRoutes } from "./routes/services.ts";
import { registerToolsRoutes } from "./routes/tools.ts";
import { registerAssistantRoutes } from "./routes/assistant.ts";
import { registerOperationsRoutes } from "./routes/operations.ts";
import { registerIncidentsRoutes } from "./routes/incidents.ts";
import { ServiceManager } from "./services/serviceManager.ts";
import { ToolService } from "./services/toolService.ts";
import { AssistantService } from "./services/assistantService.ts";
import { OperationService } from "./services/operationService.ts";
import { IncidentService } from "./services/incidentService.ts";
import type { LlmProvider } from "./interfaces/assistant.ts";
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
  LlmProvider,
};

export interface AppOptions {
  dockerClient?: DockerClient;
  serviceManager?: ServiceManager;
  toolService?: ToolService;
  assistantService?: AssistantService;
  operationService?: OperationService;
  incidentService?: IncidentService;
  llmProvider?: LlmProvider;
}

export function buildApp(options: AppOptions = {}) {
  const app = Fastify();
  const serviceManager =
    options.serviceManager ??
    new ServiceManager({ dockerClient: options.dockerClient });
  const toolService =
    options.toolService ?? new ToolService(serviceManager);
  const operationService =
    options.operationService ?? new OperationService(serviceManager);
  const incidentService =
    options.incidentService ?? new IncidentService(serviceManager);
  const assistantService =
    options.assistantService ??
    new AssistantService({
      toolService,
      operationService,
      llmProvider: options.llmProvider,
    });

  registerServicesRoutes(app, { serviceManager });
  registerToolsRoutes(app, { toolService });
  registerAssistantRoutes(app, { assistantService });
  registerOperationsRoutes(app, { operationService });
  registerIncidentsRoutes(app, { incidentService });

  return app;
}
