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

describe("POST /api/mcp (tools/call request_service_operation)", () => {
  it("creates a pending operation (L2/L3) with actor mcp without executing container action, and audits rejected policy violations", async () => {
    const executedActions: string[] = [];

    const app = buildApp({
      dockerClient: {
        async getContainerStatus() {
          return "running";
        },
        async executeContainerAction(containerId, action) {
          executedActions.push(`${containerId}:${action}`);
        },
      },
    });

    const srvRes = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: {
        name: "vaultwarden",
        externalId: "vw-ctr",
        integration: "docker",
        allowedActions: ["restart", "start"],
      },
    });
    const service = srvRes.json();

    // 1. Allowed action creates pending operation attributed to mcp without autonomous execution
    const reqOpRes = await app.inject({
      method: "POST",
      url: "/api/mcp",
      payload: {
        jsonrpc: "2.0",
        id: 20,
        method: "tools/call",
        params: {
          name: "request_service_operation",
          arguments: {
            service_id: service.id,
            action: "restart",
          },
        },
      },
    });

    expect(reqOpRes.statusCode).toBe(200);
    const reqOpBody = reqOpRes.json();
    expect(reqOpBody.result.isError).toBe(false);
    const pendingOp = reqOpBody.result.data.operation;
    expect(pendingOp).toMatchObject({
      serviceId: service.id,
      action: "restart",
      riskLevel: "L2",
      status: "pending",
      actor: "mcp",
    });
    expect(pendingOp.confirmationToken).toBeDefined();
    expect(executedActions).toHaveLength(0);

    // Pending operation is queryable for the Control Center UI
    const pendingListRes = await app.inject({
      method: "GET",
      url: `/api/operations/pending?serviceId=${service.id}`,
    });
    expect(pendingListRes.statusCode).toBe(200);
    expect(pendingListRes.json()).toHaveLength(1);
    expect(pendingListRes.json()[0].id).toBe(pendingOp.id);

    // Human admin confirms the pending operation
    const confirmRes = await app.inject({
      method: "POST",
      url: `/api/operations/${pendingOp.id}/confirm`,
      payload: { confirmationToken: pendingOp.confirmationToken },
    });
    expect(confirmRes.statusCode).toBe(200);
    expect(executedActions).toEqual(["vw-ctr:restart"]);

    // 2. Disallowed action (stop) is rejected and audited with actor: mcp
    const disallowedRes = await app.inject({
      method: "POST",
      url: "/api/mcp",
      payload: {
        jsonrpc: "2.0",
        id: 21,
        method: "tools/call",
        params: {
          name: "request_service_operation",
          arguments: {
            service_id: service.id,
            action: "stop",
          },
        },
      },
    });

    expect(disallowedRes.statusCode).toBe(200);
    const disallowedBody = disallowedRes.json();
    expect(disallowedBody.error).toBeDefined();
    expect(disallowedBody.error.message).toContain("not permitted by policy");
    expect(executedActions).toEqual(["vw-ctr:restart"]);

    const auditRes = await app.inject({
      method: "GET",
      url: `/api/audit?serviceId=${service.id}`,
    });
    const auditLog = auditRes.json();
    expect(auditLog).toContainEqual(
      expect.objectContaining({
        actor: "mcp",
        action: "stop",
        riskLevel: "L3",
        serviceId: service.id,
        outcome: "rejected",
      })
    );
  });
});
