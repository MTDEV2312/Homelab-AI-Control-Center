import type { FastifyInstance } from "fastify";
import type { N8nService } from "../services/n8nService.ts";
import type { N8nFailedExecutionFilter } from "../interfaces/n8n.ts";

export function registerN8nRoutes(
  app: FastifyInstance,
  options: { n8nService: N8nService }
) {
  const { n8nService } = options;

  app.get("/api/n8n/workflows", async () => {
    return n8nService.listWorkflows();
  });

  app.get<{ Querystring: N8nFailedExecutionFilter }>(
    "/api/n8n/executions/failed",
    async (request) => {
      return n8nService.listFailedExecutions(request.query);
    }
  );
}
