import type { FastifyInstance } from "fastify";
import type { N8nService } from "../services/n8nService.ts";

export function registerN8nRoutes(
  app: FastifyInstance,
  options: { n8nService: N8nService }
) {
  const { n8nService } = options;

  app.get("/api/n8n/workflows", async () => {
    return n8nService.listWorkflows();
  });
}
