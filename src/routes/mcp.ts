import type { FastifyInstance } from "fastify";
import type { McpService } from "../services/mcpService.ts";
import type { JsonRpcRequest } from "../interfaces/mcp.ts";

export function registerMcpRoutes(
  app: FastifyInstance,
  options: { mcpService: McpService }
) {
  const { mcpService } = options;

  app.get("/api/mcp/status", async () => {
    return {
      enabled: true,
      toolCount: mcpService.getMcpTools().length,
    };
  });

  app.post<{ Body: JsonRpcRequest }>("/api/mcp", async (request) => {
    return mcpService.handleRpc(request.body);
  });
}
