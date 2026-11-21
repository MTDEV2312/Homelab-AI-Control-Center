import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it, expect, afterEach } from "vitest";
import { buildApp } from "../../src/app.ts";
import { N8nAdapter } from "../../src/adapters/n8nAdapter.ts";

describe("N8nAdapter", () => {
  let activeServer: http.Server | null = null;

  afterEach(async () => {
    if (activeServer) {
      await new Promise<void>((resolve) => activeServer!.close(() => resolve()));
      activeServer = null;
    }
  });

  async function startMockN8nServer(
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
  ): Promise<string> {
    activeServer = http.createServer(handler);
    await new Promise<void>((resolve) => {
      activeServer!.listen(0, "localhost", () => resolve());
    });
    const addr = activeServer.address() as AddressInfo;
    return `http://localhost:${addr.port}`;
  }

  it("fetches live workflows with X-N8N-API-KEY header and maps active, inactive, updatedAt, and summary counts", async () => {
    let receivedApiKey: string | string[] | undefined;

    const baseUrl = await startMockN8nServer((req, res) => {
      if (req.url === "/api/v1/workflows") {
        receivedApiKey = req.headers["x-n8n-api-key"];
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            data: [
              {
                id: "wf-1",
                name: "Nightly Backup",
                active: true,
                updatedAt: "2026-11-20T18:00:00.000Z",
              },
              {
                id: "wf-2",
                name: "Paused Sync",
                active: false,
                updatedAt: "2026-11-19T12:30:00.000Z",
              },
            ],
            nextCursor: null,
          })
        );
        return;
      }

      res.writeHead(404).end();
    });

    const app = buildApp({
      n8nClient: new N8nAdapter({ baseUrl, apiKey: "test-n8n-key" }),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/n8n/workflows",
      });

      expect(receivedApiKey).toBe("test-n8n-key");
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        integrationStatus: "available",
        summary: { total: 2, active: 1, failedExecutions: 0 },
        workflows: [
          {
            id: "wf-1",
            name: "Nightly Backup",
            active: true,
            updatedAt: "2026-11-20T18:00:00.000Z",
          },
          {
            id: "wf-2",
            name: "Paused Sync",
            active: false,
            updatedAt: "2026-11-19T12:30:00.000Z",
          },
        ],
      });
    } finally {
      await app.close();
    }
  });
});
