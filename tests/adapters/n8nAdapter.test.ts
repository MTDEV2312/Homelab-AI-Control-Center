import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it, expect, afterEach } from "vitest";
import { buildApp } from "../../src/app.ts";
import { N8nAdapter } from "../../src/adapters/n8nAdapter.ts";
import { createAdaptersFromEnv } from "../../src/config/env.ts";

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

      if (req.url?.startsWith("/api/v1/executions")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: [] }));
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

  it("createAdaptersFromEnv wires n8nClient from N8N_URL and N8N_API_KEY while ignoring placeholders and partial config", async () => {
    const placeholderAdapters = createAdaptersFromEnv({
      N8N_URL: "your_n8n_url_here",
      N8N_API_KEY: "your_n8n_api_key_here",
    });
    expect(placeholderAdapters.n8nClient).toBeUndefined();

    const placeholderApp = buildApp(placeholderAdapters);
    try {
      const res = await placeholderApp.inject({
        method: "GET",
        url: "/api/n8n/workflows",
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        integrationStatus: "available",
        summary: { total: 0, active: 0, failedExecutions: 0 },
        workflows: [],
      });
    } finally {
      await placeholderApp.close();
    }

    expect(
      createAdaptersFromEnv({ N8N_URL: "http://localhost:5678" }).n8nClient
    ).toBeUndefined();
    expect(
      createAdaptersFromEnv({ N8N_API_KEY: "test-n8n-key" }).n8nClient
    ).toBeUndefined();

    const baseUrl = await startMockN8nServer((req, res) => {
      if (req.url === "/api/v1/workflows") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            data: [
              {
                id: "wf-9",
                name: "Daily Report",
                active: true,
                updatedAt: "2026-11-20T19:00:00.000Z",
              },
            ],
          })
        );
        return;
      }

      if (req.url?.startsWith("/api/v1/executions")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: [] }));
        return;
      }

      res.writeHead(404).end();
    });

    const adapters = createAdaptersFromEnv({
      N8N_URL: baseUrl,
      N8N_API_KEY: "test-n8n-key",
      N8N_TIMEOUT_MS: "2500",
    });
    expect(adapters.n8nClient).toBeDefined();

    const app = buildApp(adapters);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/n8n/workflows",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        integrationStatus: "available",
        summary: { total: 1, active: 1, failedExecutions: 0 },
        workflows: [
          {
            id: "wf-9",
            name: "Daily Report",
            active: true,
            updatedAt: "2026-11-20T19:00:00.000Z",
          },
        ],
      });
    } finally {
      await app.close();
    }
  });

  it("fetches failed executions with redacted error details and treats crashed runs as errors", async () => {
    let receivedApiKey: string | string[] | undefined;
    let receivedIncludeData: string | null = null;

    const baseUrl = await startMockN8nServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname === "/api/v1/executions") {
        receivedApiKey = req.headers["x-n8n-api-key"];
        receivedIncludeData = url.searchParams.get("includeData");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            data: [
              {
                id: "101",
                workflowId: "wf-1",
                status: "success",
                startedAt: "2026-11-22T10:00:00.000Z",
                stoppedAt: "2026-11-22T10:00:05.000Z",
                workflowData: { name: "Nightly Backup" },
              },
              {
                id: "102",
                workflowId: "wf-2",
                status: "error",
                startedAt: "2026-11-22T12:00:00.000Z",
                stoppedAt: "2026-11-22T12:00:03.000Z",
                workflowData: { name: "Alert Webhook Relay" },
                data: {
                  resultData: {
                    error: { message: "Webhook rejected: Bearer sample_bearer_value" },
                  },
                },
              },
              {
                id: "103",
                workflowId: "wf-3",
                status: "crashed",
                startedAt: "2026-11-22T13:00:00.000Z",
                data: {
                  resultData: {
                    error: { message: "Upstream failed with token=sample_token_value" },
                  },
                },
              },
            ],
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
        url: "/api/n8n/executions/failed",
      });

      expect(receivedApiKey).toBe("test-n8n-key");
      expect(receivedIncludeData).toBe("true");
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        integrationStatus: "available",
        executions: [
          {
            id: "102",
            workflowId: "wf-2",
            workflowName: "Alert Webhook Relay",
            status: "error",
            startedAt: "2026-11-22T12:00:00.000Z",
            stoppedAt: "2026-11-22T12:00:03.000Z",
            errorMessage: "Webhook rejected: Bearer [REDACTED]",
          },
          {
            id: "103",
            workflowId: "wf-3",
            workflowName: "wf-3",
            status: "error",
            startedAt: "2026-11-22T13:00:00.000Z",
            errorMessage: "Upstream failed with token=[REDACTED]",
          },
        ],
      });
    } finally {
      await app.close();
    }
  });

  it("filters failed executions by workflowId (forwarded upstream) and since timestamp", async () => {
    const receivedWorkflowIds: Array<string | null> = [];

    const baseUrl = await startMockN8nServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname === "/api/v1/executions") {
        receivedWorkflowIds.push(url.searchParams.get("workflowId"));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            data: [
              {
                id: "201",
                workflowId: "wf-1",
                status: "error",
                startedAt: "2026-11-22T09:00:00.000Z",
                workflowData: { name: "Backup" },
                data: { resultData: { error: { message: "Disk full" } } },
              },
              {
                id: "202",
                workflowId: "wf-2",
                status: "error",
                startedAt: "2026-11-22T11:00:00.000Z",
                workflowData: { name: "Alert Relay" },
                data: { resultData: { error: { message: "Timeout" } } },
              },
              {
                id: "203",
                workflowId: "wf-2",
                status: "error",
                startedAt: "2026-11-22T15:00:00.000Z",
                workflowData: { name: "Alert Relay" },
                data: { resultData: { error: { message: "DNS error" } } },
              },
            ],
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
        url: "/api/n8n/executions/failed?workflowId=wf-2&since=2026-11-22T12:00:00.000Z",
      });

      expect(receivedWorkflowIds).toEqual(["wf-2"]);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        integrationStatus: "available",
        executions: [
          {
            id: "203",
            workflowId: "wf-2",
            workflowName: "Alert Relay",
            status: "error",
            startedAt: "2026-11-22T15:00:00.000Z",
            errorMessage: "DNS error",
          },
        ],
      });
    } finally {
      await app.close();
    }
  });
});
