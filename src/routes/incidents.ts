import type { FastifyInstance } from "fastify";
import type { IncidentService } from "../services/incidentService.ts";
import type { CreateIncidentInput, IncidentStatus } from "../interfaces/incident.ts";

export function registerIncidentsRoutes(
  app: FastifyInstance,
  options: { incidentService: IncidentService }
) {
  const { incidentService } = options;

  app.post<{ Body: CreateIncidentInput }>("/api/incidents", async (request, reply) => {
    const { serviceId, title, severity } = request.body || {};
    if (!serviceId || !title || !severity) {
      return reply.status(400).send({ error: "Missing required fields: serviceId, title, severity" });
    }

    const incident = await incidentService.create(request.body);
    if (!incident) {
      return reply.status(404).send({ error: "Service not found" });
    }

    return reply.status(201).send(incident);
  });

  app.get<{ Querystring: { serviceId?: string; status?: IncidentStatus } }>(
    "/api/incidents",
    async (request) => {
      return incidentService.list(request.query);
    }
  );
}
