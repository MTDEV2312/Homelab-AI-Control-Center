import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it, expect, afterEach } from "vitest";
import { buildApp } from "../../src/app.ts";
import { UptimeKumaAdapter } from "../../src/adapters/uptimeKumaAdapter.ts";

describe("UptimeKumaAdapter", () => {
  let activeServer: http.Server | null = null;

  afterEach(async () => {
    if (activeServer) {
      await new Promise<void>((resolve) => activeServer!.close(() => resolve()));
      activeServer = null;
    }
  });

  async function startMockKumaServer(
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
  ): Promise<string> {
    activeServer = http.createServer(handler);
    await new Promise<void>((resolve) => {
      activeServer!.listen(0, "localhost", () => resolve());
    });
    const addr = activeServer.address() as AddressInfo;
    return `http://localhost:${addr.port}`;
  }

  it("fetches monitors with mapped status, heartbeats, latency, and uptimePercent", async () => {
    const baseUrl = await startMockKumaServer((req, res) => {
      if (req.url === "/api/status-page/homelab") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            publicGroupList: [
              {
                id: 1,
                name: "Core",
                monitorList: [{ id: 10, name: "Nginx Proxy", url: "https://proxy.local" }],
              },
            ],
          })
        );
        return;
      }

      if (req.url === "/api/status-page/heartbeat/homelab") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            heartbeatList: {
              "10": [
                { status: 1, time: "2026-11-20 20:00:00.000", msg: "200 - OK", ping: 42 },
                { status: 1, time: "2026-11-20 20:01:00.000", msg: "200 - OK", ping: 35 },
              ],
            },
            uptimeList: { "10_24": 0.995 },
          })
        );
        return;
      }

      res.writeHead(404).end();
    });

    const app = buildApp({
      uptimeKumaClient: new UptimeKumaAdapter({ baseUrl, slug: "homelab" }),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/uptime-kuma/monitors",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        integrationStatus: "available",
        monitors: [
          {
            id: "10",
            name: "Nginx Proxy",
            url: "https://proxy.local",
            status: "up",
            uptimePercent: 99.5,
            latencyMs: 35,
            heartbeats: [
              {
                status: "up",
                timestamp: "2026-11-20 20:00:00.000",
                latencyMs: 42,
                message: "200 - OK",
              },
              {
                status: "up",
                timestamp: "2026-11-20 20:01:00.000",
                latencyMs: 35,
                message: "200 - OK",
              },
            ],
          },
        ],
      });
    } finally {
      await app.close();
    }
  });
});
