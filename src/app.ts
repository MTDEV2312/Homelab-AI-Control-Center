import Fastify from "fastify";
import crypto from "node:crypto";

export interface Service {
  id: string;
  name: string;
  externalId: string;
  integration: string;
  createdAt: string;
}

export function buildApp() {
  const app = Fastify();
  const services: Service[] = [];

  app.post<{
    Body: { name: string; externalId: string; integration: string };
  }>("/api/services", async (request, reply) => {
    const { name, externalId, integration } = request.body;

    const newService: Service = {
      id: crypto.randomUUID(),
      name,
      externalId,
      integration,
      createdAt: new Date().toISOString(),
    };

    services.push(newService);
    return reply.status(201).send(newService);
  });

  return app;
}
