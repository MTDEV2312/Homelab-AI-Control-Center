import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it, expect, afterEach } from "vitest";
import { buildApp } from "../../src/app.ts";
import { UptimeKumaAdapter } from "../../src/adapters/uptimeKumaAdapter.ts";
import { createAdaptersFromEnv } from "../../src/config/env.ts";

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

  it("maps all Uptime Kuma status codes (1=up, 0=down, 2=pending, 3=maintenance) and handles empty heartbeats", async () => {
    const baseUrl = await startMockKumaServer((req, res) => {
      if (req.url === "/api/status-page/homelab") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            publicGroupList: [
              {
                id: 1,
                name: "Services",
                monitorList: [
                  { id: 1, name: "Up Svc" },
                  { id: 2, name: "Down Svc" },
                  { id: 3, name: "Pending Svc" },
                  { id: 4, name: "Maint Svc" },
                  { id: 5, name: "No Beat Svc" },
                ],
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
              "1": [{ status: 1, time: "2026-11-20 20:00:00.000", ping: 12 }],
              "2": [
                {
                  status: 0,
                  time: "2026-11-20 20:00:00.000",
                  msg: "Connection refused",
                  ping: 0,
                },
              ],
              "3": [{ status: 2, time: "2026-11-20 20:00:00.000", ping: null }],
              "4": [{ status: 3, time: "2026-11-20 20:00:00.000", ping: 5 }],
            },
            uptimeList: {
              "1_24": 1,
              "2_24": 0.5,
              "3_24": 0,
              "4_24": 0.9825,
            },
          })
        );
        return;
      }

      res.writeHead(404).end();
    });

    const adapter = new UptimeKumaAdapter({ baseUrl, slug: "homelab" });
    const monitors = await adapter.getMonitors();

    expect(monitors).toEqual([
      {
        id: "1",
        name: "Up Svc",
        status: "up",
        uptimePercent: 100,
        latencyMs: 12,
        heartbeats: [
          { status: "up", timestamp: "2026-11-20 20:00:00.000", latencyMs: 12 },
        ],
      },
      {
        id: "2",
        name: "Down Svc",
        status: "down",
        uptimePercent: 50,
        latencyMs: 0,
        heartbeats: [
          {
            status: "down",
            timestamp: "2026-11-20 20:00:00.000",
            latencyMs: 0,
            message: "Connection refused",
          },
        ],
      },
      {
        id: "3",
        name: "Pending Svc",
        status: "pending",
        uptimePercent: 0,
        latencyMs: 0,
        heartbeats: [
          { status: "pending", timestamp: "2026-11-20 20:00:00.000", latencyMs: 0 },
        ],
      },
      {
        id: "4",
        name: "Maint Svc",
        status: "maintenance",
        uptimePercent: 98.25,
        latencyMs: 5,
        heartbeats: [
          { status: "maintenance", timestamp: "2026-11-20 20:00:00.000", latencyMs: 5 },
        ],
      },
      {
        id: "5",
        name: "No Beat Svc",
        status: "pending",
        uptimePercent: 0,
        latencyMs: 0,
        heartbeats: [],
      },
    ]);
  });

  it("degrades to unavailable when Uptime Kuma returns HTTP error", async () => {
    const baseUrl = await startMockKumaServer((_req, res) => {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, msg: "Service unavailable" }));
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
        integrationStatus: "unavailable",
        monitors: [],
      });
    } finally {
      await app.close();
    }
  });

  it("aborts and degrades to unavailable on request timeout", async () => {
    const baseUrl = await startMockKumaServer((req, res) => {
      const timer = setTimeout(() => {
        if (res.writableEnded) return;
        res.writeHead(200, { "Content-Type": "application/json" });
        if (req.url?.includes("/heartbeat/")) {
          res.end(JSON.stringify({ heartbeatList: {}, uptimeList: {} }));
        } else {
          res.end(JSON.stringify({ publicGroupList: [] }));
        }
      }, 400);

      req.on("close", () => clearTimeout(timer));
    });

    const app = buildApp({
      uptimeKumaClient: new UptimeKumaAdapter({
        baseUrl,
        slug: "homelab",
        timeoutMs: 50,
      }),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/uptime-kuma/monitors",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        integrationStatus: "unavailable",
        monitors: [],
      });
    } finally {
      await app.close();
    }
  });

  it("throws when baseUrl or slug is missing", () => {
    expect(() => new UptimeKumaAdapter({ baseUrl: "   ", slug: "homelab" })).toThrow(
      "UptimeKumaAdapter requires both baseUrl and slug"
    );
    expect(
      () => new UptimeKumaAdapter({ baseUrl: "http://localhost:3001", slug: "   " })
    ).toThrow("UptimeKumaAdapter requires both baseUrl and slug");
  });

  it("createAdaptersFromEnv wires uptimeKumaClient and ignores placeholder values", async () => {
    const placeholderAdapters = createAdaptersFromEnv({
      UPTIME_KUMA_URL: "your_uptime_kuma_url_here",
      UPTIME_KUMA_SLUG: "your_uptime_kuma_status_page_slug_here",
    });
    expect(placeholderAdapters.uptimeKumaClient).toBeUndefined();

    const partialAdapters = createAdaptersFromEnv({
      UPTIME_KUMA_URL: "http://localhost:3001",
    });
    expect(partialAdapters.uptimeKumaClient).toBeUndefined();

    const baseUrl = await startMockKumaServer((req, res) => {
      if (req.url === "/api/status-page/homelab") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            publicGroupList: [
              { id: 1, name: "Infra", monitorList: [{ id: 7, name: "DNS" }] },
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
              "7": [{ status: 1, time: "2026-11-20 20:00:00.000", ping: 11 }],
            },
            uptimeList: { "7_24": 1 },
          })
        );
        return;
      }

      res.writeHead(404).end();
    });

    const adapters = createAdaptersFromEnv({
      UPTIME_KUMA_URL: baseUrl,
      UPTIME_KUMA_SLUG: "homelab",
      UPTIME_KUMA_TIMEOUT_MS: "2500",
    });
    expect(adapters.uptimeKumaClient).toBeDefined();

    const app = buildApp(adapters);
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
            id: "7",
            name: "DNS",
            status: "up",
            uptimePercent: 100,
            latencyMs: 11,
            heartbeats: [
              {
                status: "up",
                timestamp: "2026-11-20 20:00:00.000",
                latencyMs: 11,
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
