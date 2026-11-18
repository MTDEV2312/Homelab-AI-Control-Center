import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.ts";

describe("POST /api/mcp (initialize & tools/list)", () => {
  it("handles initialize and tools/list returning read tools (list_services, get_service_status, search_logs, list_incidents) and controlled write tool (request_service_operation)", async () => {
    const app = buildApp();

    // 1. MCP initialize handshake
    const initRes = await app.inject({
      method: "POST",
      url: "/api/mcp",
      payload: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          clientInfo: { name: "external-cli-agent", version: "1.0.0" },
        },
      },
    });

    expect(initRes.statusCode).toBe(200);
    expect(initRes.json()).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: "homelab-ai-control-center-mcp",
          version: "0.1.0",
        },
        capabilities: {
          tools: {},
        },
      },
    });

    // 2. MCP tools/list discovery
    const listRes = await app.inject({
      method: "POST",
      url: "/api/mcp",
      payload: {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      },
    });

    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json();
    expect(listBody.jsonrpc).toBe("2.0");
    expect(listBody.id).toBe(2);
    const tools = listBody.result.tools;
    expect(tools).toHaveLength(5);

    const toolNames = tools.map((t: { name: string }) => t.name);
    expect(toolNames).toEqual([
      "list_services",
      "get_service_status",
      "search_logs",
      "list_incidents",
      "request_service_operation",
    ]);

    const opTool = tools.find((t: { name: string }) => t.name === "request_service_operation");
    expect(opTool.readOnly).toBe(false);
    expect(opTool.inputSchema.required).toEqual(["service_id", "action"]);

    // 3. GET /api/mcp/status reports active MCP server and tool count
    const statusRes = await app.inject({
      method: "GET",
      url: "/api/mcp/status",
    });
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json()).toEqual({
      enabled: true,
      toolCount: 5,
    });
  });
});

describe("POST /api/mcp (tools/call read tools)", () => {
  it("executes read tools (list_services, get_service_status, search_logs with redaction, and list_incidents with filters) using shared services", async () => {
    const app = buildApp({
      dockerClient: {
        async getContainerStatus() {
          return "running";
        },
        async getContainerMetrics() {
          return {
            cpuPercent: 18.4,
            memoryUsedBytes: 256000000,
            memoryLimitBytes: 1024000000,
            uptimeSeconds: 7200,
          };
        },
        async getContainerLogs() {
          return [
            {
              timestamp: "2026-11-17T22:00:00Z",
              level: "error",
              message: "Upstream failed with Bearer sample_bearer_value",
            },
          ];
        },
      },
    });

    const srvRes = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "jellyfin", externalId: "jf-ctr", integration: "docker" },
    });
    const service = srvRes.json();

    await app.inject({
      method: "POST",
      url: "/api/incidents",
      payload: {
        serviceId: service.id,
        title: "Gateway timeout",
        severity: "high",
        hypotheses: ["Proxy misconfiguration"],
      },
    });

    // 1. list_services via MCP tools/call
    const listServicesRes = await app.inject({
      method: "POST",
      url: "/api/mcp",
      payload: {
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: {
          name: "list_services",
          arguments: { status: "running" },
        },
      },
    });
    expect(listServicesRes.statusCode).toBe(200);
    const listServicesBody = listServicesRes.json();
    expect(listServicesBody.result.isError).toBe(false);
    expect(listServicesBody.result.data.services).toHaveLength(1);
    expect(listServicesBody.result.data.services[0]).toMatchObject({
      id: service.id,
      name: "jellyfin",
      status: "running",
    });

    // 2. get_service_status via MCP tools/call
    const statusRes = await app.inject({
      method: "POST",
      url: "/api/mcp",
      payload: {
        jsonrpc: "2.0",
        id: 11,
        method: "tools/call",
        params: {
          name: "get_service_status",
          arguments: { service_id: service.id },
        },
      },
    });
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json().result.data).toMatchObject({
      id: service.id,
      name: "jellyfin",
      status: "running",
      metrics: {
        available: true,
        cpuPercent: 18.4,
      },
    });

    // 3. search_logs via MCP tools/call (verifying sensitive data redaction)
    const logsRes = await app.inject({
      method: "POST",
      url: "/api/mcp",
      payload: {
        jsonrpc: "2.0",
        id: 12,
        method: "tools/call",
        params: {
          name: "search_logs",
          arguments: { service_id: service.id, level: "error" },
        },
      },
    });
    expect(logsRes.statusCode).toBe(200);
    expect(logsRes.json().result.data.entries).toHaveLength(1);
    expect(logsRes.json().result.data.entries[0].message).toBe(
      "Upstream failed with Bearer [REDACTED]"
    );

    // 4. list_incidents via MCP tools/call
    const incidentsRes = await app.inject({
      method: "POST",
      url: "/api/mcp",
      payload: {
        jsonrpc: "2.0",
        id: 13,
        method: "tools/call",
        params: {
          name: "list_incidents",
          arguments: { service_id: service.id, status: "open" },
        },
      },
    });
    expect(incidentsRes.statusCode).toBe(200);
    expect(incidentsRes.json().result.data.incidents).toHaveLength(1);
    expect(incidentsRes.json().result.data.incidents[0]).toMatchObject({
      serviceId: service.id,
      title: "Gateway timeout",
      severity: "high",
      status: "open",
    });
  });
});
