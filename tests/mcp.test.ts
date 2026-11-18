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
