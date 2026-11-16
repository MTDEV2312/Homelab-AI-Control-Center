import type { FastifyInstance } from "fastify";
import type { UptimeKumaService } from "../services/uptimeKumaService.ts";

export function registerUptimeKumaRoutes(
  app: FastifyInstance,
  options: { uptimeKumaService: UptimeKumaService }
) {
  const { uptimeKumaService } = options;

  app.get("/api/uptime-kuma/monitors", async () => {
    return uptimeKumaService.listMonitors();
  });

  app.post<{ Params: { monitorId: string }; Body: { serviceId?: string } }>(
    "/api/uptime-kuma/monitors/:monitorId/link",
    async (request, reply) => {
      const { serviceId } = request.body || {};
      if (!serviceId) {
        return reply.status(400).send({ error: "Missing required field: serviceId" });
      }

      const linked = await uptimeKumaService.linkMonitor(request.params.monitorId, serviceId);
      if (!linked) {
        return reply.status(404).send({ error: "Monitor or service not found" });
      }

      return reply.status(200).send(linked);
    }
  );
}
