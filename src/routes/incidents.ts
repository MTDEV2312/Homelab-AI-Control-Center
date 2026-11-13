import type { FastifyInstance } from "fastify";
import type { IncidentService } from "../services/incidentService.ts";
import type { CreateIncidentInput, UpdateIncidentInput, IncidentStatus } from "../interfaces/incident.ts";

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

  app.patch<{ Params: { id: string }; Body: UpdateIncidentInput }>(
    "/api/incidents/:id",
    async (request, reply) => {
      const { id } = request.params;
      const incident = incidentService.update(id, request.body || {});
      if (!incident) {
        return reply.status(404).send({ error: "Incident not found" });
      }
      return reply.status(200).send(incident);
    }
  );
}
