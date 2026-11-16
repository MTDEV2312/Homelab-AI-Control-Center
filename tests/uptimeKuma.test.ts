import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.ts";
import type { UptimeKumaClient } from "../src/interfaces/uptimeKuma.ts";

describe("GET /api/uptime-kuma/monitors", () => {
  it("returns monitors with status, uptime percentage, latency, and heartbeat history", async () => {
    const mockUptimeKumaClient: UptimeKumaClient = {
      async getMonitors() {
        return [
          {
            id: "mon-1",
            name: "Jellyfin External HTTPS",
            url: "https://media.homelab.local",
            status: "up",
            uptimePercent: 99.85,
            latencyMs: 42,
            heartbeats: [
              { status: "up", timestamp: "2026-11-15T20:00:00Z", latencyMs: 40 },
              { status: "up", timestamp: "2026-11-15T20:01:00Z", latencyMs: 42 },
            ],
          },
          {
            id: "mon-2",
            name: "Vaultwarden Public Endpoint",
            url: "https://vault.homelab.local",
            status: "down",
            uptimePercent: 94.2,
            latencyMs: 0,
            heartbeats: [
              { status: "up", timestamp: "2026-11-15T20:00:00Z", latencyMs: 35 },
              {
                status: "down",
                timestamp: "2026-11-15T20:01:00Z",
                latencyMs: 0,
                message: "502 Bad Gateway",
              },
            ],
          },
        ];
      },
    };

    const app = buildApp({ uptimeKumaClient: mockUptimeKumaClient });

    const res = await app.inject({
      method: "GET",
      url: "/api/uptime-kuma/monitors",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.integrationStatus).toBe("available");
    expect(body.monitors).toHaveLength(2);
    expect(body.monitors[0]).toMatchObject({
      id: "mon-1",
      name: "Jellyfin External HTTPS",
      status: "up",
      uptimePercent: 99.85,
      latencyMs: 42,
    });
    expect(body.monitors[0].heartbeats).toHaveLength(2);
    expect(body.monitors[1]).toMatchObject({
      id: "mon-2",
      name: "Vaultwarden Public Endpoint",
      status: "down",
      uptimePercent: 94.2,
    });
    expect(body.monitors[1].heartbeats[1].message).toBe("502 Bad Gateway");
  });
});

describe("POST /api/uptime-kuma/monitors/:monitorId/link", () => {
  it("links monitor to a registered service and enriches GET /api/services and GET /api/services/:id with external monitor status and history", async () => {
    const mockUptimeKumaClient: UptimeKumaClient = {
      async getMonitors() {
        return [
          {
            id: "mon-vw",
            name: "Vaultwarden Public Endpoint",
            url: "https://vault.homelab.local",
            status: "down",
            uptimePercent: 94.2,
            latencyMs: 0,
            heartbeats: [
              { status: "up", timestamp: "2026-11-15T20:00:00Z", latencyMs: 35 },
              {
                status: "down",
                timestamp: "2026-11-15T20:01:00Z",
                latencyMs: 0,
                message: "502 Bad Gateway",
              },
            ],
          },
        ];
      },
    };

    const app = buildApp({
      dockerClient: {
        async getContainerStatus() {
          return "running";
        },
      },
      uptimeKumaClient: mockUptimeKumaClient,
    });

    const srvRes = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "vaultwarden", externalId: "vw-ctr", integration: "docker" },
    });
    const service = srvRes.json();

    // 1. Link monitor to registered service
    const linkRes = await app.inject({
      method: "POST",
      url: "/api/uptime-kuma/monitors/mon-vw/link",
      payload: { serviceId: service.id },
    });

    expect(linkRes.statusCode).toBe(200);
    expect(linkRes.json()).toMatchObject({
      id: "mon-vw",
      serviceId: service.id,
      status: "down",
    });

    // 2. GET /api/uptime-kuma/monitors reflects linked serviceId
    const monitorsRes = await app.inject({
      method: "GET",
      url: "/api/uptime-kuma/monitors",
    });
    expect(monitorsRes.json().monitors[0].serviceId).toBe(service.id);

    // 3. GET /api/services includes uptimeKumaMonitor alongside container status
    const listRes = await app.inject({
      method: "GET",
      url: "/api/services",
    });
    expect(listRes.statusCode).toBe(200);
    const listedService = listRes.json().services[0];
    expect(listedService.status).toBe("running");
    expect(listedService.uptimeKumaMonitor).toMatchObject({
      id: "mon-vw",
      name: "Vaultwarden Public Endpoint",
      status: "down",
      uptimePercent: 94.2,
      serviceId: service.id,
    });

    // 4. GET /api/services/:id includes uptimeKumaMonitor with heartbeat history
    const detailRes = await app.inject({
      method: "GET",
      url: `/api/services/${service.id}`,
    });
    expect(detailRes.statusCode).toBe(200);
    const detailedService = detailRes.json();
    expect(detailedService.status).toBe("running");
    expect(detailedService.uptimeKumaMonitor).toMatchObject({
      id: "mon-vw",
      status: "down",
      uptimePercent: 94.2,
    });
    expect(detailedService.uptimeKumaMonitor.heartbeats).toHaveLength(2);

    // 5. Rejects unknown service or unknown monitor with 404
    const badServiceRes = await app.inject({
      method: "POST",
      url: "/api/uptime-kuma/monitors/mon-vw/link",
      payload: { serviceId: "non-existent-srv" },
    });
    expect(badServiceRes.statusCode).toBe(404);

    const badMonitorRes = await app.inject({
      method: "POST",
      url: "/api/uptime-kuma/monitors/non-existent-mon/link",
      payload: { serviceId: service.id },
    });
    expect(badMonitorRes.statusCode).toBe(404);
  });
});
