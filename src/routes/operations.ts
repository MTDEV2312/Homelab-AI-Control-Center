import type { FastifyInstance } from "fastify";
import type { OperationService } from "../services/operationService.ts";
import type { OperationAction } from "../interfaces/operation.ts";

export function registerOperationsRoutes(
  app: FastifyInstance,
  options: { operationService: OperationService }
) {
  const { operationService } = options;

  app.post<{
    Body: {
      serviceId: string;
      action: OperationAction;
    };
  }>("/api/operations/request", async (request, reply) => {
    const { serviceId, action } = request.body || {};
    if (!serviceId || !action) {
      return reply.status(400).send({ error: "Missing required fields: serviceId and action" });
    }

    const pending = await operationService.requestOperation({ serviceId, action });
    if (!pending) {
      return reply.status(404).send({ error: "Service not found" });
    }

    return reply.status(201).send({ operation: pending });
  });
}
