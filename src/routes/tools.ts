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

  app.post("/api/tools/execute", async (request, reply) => {
    const body = (request.body || {}) as { tool?: string; parameters?: Record<string, any> };
    if (!body.tool) {
      return reply.status(400).send({ error: "Tool name is required" });
    }

    try {
      const result = await toolService.execute(body.tool, body.parameters || {});
      return reply.status(200).send({
        tool: body.tool,
        result,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}
