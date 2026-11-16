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
}
