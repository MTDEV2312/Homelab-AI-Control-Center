import type { FastifyInstance } from "fastify";
import type { AssistantService } from "../services/assistantService.ts";

export interface RegisterAssistantRoutesOptions {
  assistantService: AssistantService;
}

export function registerAssistantRoutes(
  app: FastifyInstance,
  options: RegisterAssistantRoutesOptions
) {
  const { assistantService } = options;

  app.post("/api/assistant/diagnose", async (request, reply) => {
    const body = (request.body || {}) as { query?: string; serviceId?: string };

    if (!body.query || typeof body.query !== "string") {
      return reply.status(400).send({ error: "Query is required" });
    }

    try {
      const response = await assistantService.diagnose({
        query: body.query,
        serviceId: body.serviceId,
      });

      return reply.status(200).send(response);
    } catch (err: any) {
      const message = err?.message || "Assistant error";
      const status = message.toLowerCase().includes("provider") || message.toLowerCase().includes("unavailable") ? 503 : 500;
      return reply.status(status).send({ error: message });
    }
  });
}
