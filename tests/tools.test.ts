import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.ts";

describe("GET /api/tools", () => {
  it("returns read-only tools catalog with parameter schemas", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/tools",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.tools).toBeInstanceOf(Array);
    expect(body.tools.length).toBe(3);

    const toolNames = body.tools.map((t: { name: string }) => t.name);
    expect(toolNames).toContain("list_services");
    expect(toolNames).toContain("get_service_status");
    expect(toolNames).toContain("search_logs");

    const listServices = body.tools.find((t: { name: string }) => t.name === "list_services");
    expect(listServices.description).toBeDefined();
    expect(listServices.inputSchema.properties).toHaveProperty("status");

    const getStatus = body.tools.find((t: { name: string }) => t.name === "get_service_status");
    expect(getStatus.description).toBeDefined();
    expect(getStatus.inputSchema.required).toContain("service_id");

    const searchLogs = body.tools.find((t: { name: string }) => t.name === "search_logs");
    expect(searchLogs.description).toBeDefined();
    expect(searchLogs.inputSchema.required).toContain("service_id");
    expect(searchLogs.inputSchema.properties).toHaveProperty("query");
  });
});

describe("POST /api/tools/execute", () => {
  it("runs list_services and returns services list", async () => {
    const app = buildApp();
    await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "pihole", externalId: "pihole-ctr", integration: "docker" },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/tools/execute",
      payload: {
        tool: "list_services",
        parameters: {},
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.tool).toBe("list_services");
    expect(body.result).toBeDefined();
    expect(body.result.services).toBeInstanceOf(Array);
    expect(body.result.services.length).toBe(1);
    expect(body.result.services[0].name).toBe("pihole");
  });

  it("runs get_service_status and returns status and metrics", async () => {
    const mockDocker = {
      getContainerStatus: async () => "running" as const,
      getContainerMetrics: async () => ({
        available: true,
        cpuPercent: 12.5,
        memoryUsedBytes: 1048576,
        memoryLimitBytes: 2097152,
        uptimeSeconds: 3600,
      }),
    };
    const app = buildApp({ dockerClient: mockDocker });
    const regRes = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "vaultwarden", externalId: "vw-ctr", integration: "docker" },
    });
    const serviceId = regRes.json().id;

    const response = await app.inject({
      method: "POST",
      url: "/api/tools/execute",
      payload: {
        tool: "get_service_status",
        parameters: { service_id: serviceId },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.tool).toBe("get_service_status");
    expect(body.result).toBeDefined();
    expect(body.result.id).toBe(serviceId);
    expect(body.result.status).toBe("running");
    expect(body.result.metrics).toMatchObject({
      available: true,
      cpuPercent: 12.5,
      uptimeSeconds: 3600,
    });
  });
});
