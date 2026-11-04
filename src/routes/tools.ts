import type { FastifyInstance } from "fastify";
import type { ToolService } from "../services/toolService.ts";

export interface RegisterToolsRoutesOptions {
  toolService: ToolService;
}

export function registerToolsRoutes(
  app: FastifyInstance,
  options: RegisterToolsRoutesOptions
) {
  const { toolService } = options;

  app.get("/api/tools", async (_request, reply) => {
    return reply.status(200).send({
      tools: toolService.getTools(),
    });
  });
}
