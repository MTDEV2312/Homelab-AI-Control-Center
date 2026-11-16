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
