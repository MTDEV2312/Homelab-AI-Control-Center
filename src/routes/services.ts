import type { FastifyInstance } from "fastify";
import type { ServiceManager } from "../services/serviceManager.ts";
import type { LogFilterOptions } from "../interfaces/service.ts";

export interface ServicesRouteOptions {
  serviceManager: ServiceManager;
}

export async function registerServicesRoutes(
  app: FastifyInstance,
  options: ServicesRouteOptions
) {
  const { serviceManager } = options;

  app.post<{
    Body: { name: string; externalId: string; integration: string };
  }>("/api/services", async (request, reply) => {
    const created = await serviceManager.register(request.body);
    return reply.status(201).send(created);
  });

  app.get("/api/services", async () => {
    return serviceManager.list();
  });

  app.get<{ Params: { id: string } }>("/api/services/:id", async (request, reply) => {
    const result = await serviceManager.getById(request.params.id);
    if (!result) {
      return reply.status(404).send({ message: "Service not found" });
    }
    return result;
  });

  app.get<{ Params: { id: string }; Querystring: LogFilterOptions }>(
    "/api/services/:id/logs",
    async (request, reply) => {
      const result = await serviceManager.getLogs(request.params.id, request.query);
      if (!result) {
        return reply.status(404).send({ message: "Service not found" });
      }
      return result;
    }
  );
}
