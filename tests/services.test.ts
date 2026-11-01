import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.ts";

describe("POST /api/services", () => {
  it("registers a valid Docker service", async () => {
    const app = buildApp();
    const payload = {
      name: "jellyfin",
      externalId: "jellyfin-container",
      integration: "docker",
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/services",
      payload,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({
      name: "jellyfin",
      externalId: "jellyfin-container",
      integration: "docker",
    });
    expect(body.id).toBeDefined();
    expect(body.createdAt).toBeDefined();
  });
});

describe("GET /api/services", () => {
  it("returns registered services with mapped live Docker status and summary counts", async () => {
    const mockDocker = {
      getContainerStatus: async (containerId: string) => {
        if (containerId === "c-1") return "running" as const;
        if (containerId === "c-2") return "unhealthy" as const;
        return "stopped" as const;
      },
    };

    const app = buildApp({ dockerClient: mockDocker });

    await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "srv-1", externalId: "c-1", integration: "docker" },
    });
    await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "srv-2", externalId: "c-2", integration: "docker" },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/services",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.summary).toEqual({
      total: 2,
      online: 1,
      unhealthy: 1,
    });

    expect(body.services).toHaveLength(2);
    expect(body.services[0]).toMatchObject({
      name: "srv-1",
      status: "running",
      integration: "docker",
    });
    expect(body.services[0].lastCheckedAt).toBeDefined();

    expect(body.services[1]).toMatchObject({
      name: "srv-2",
      status: "unhealthy",
      integration: "docker",
    });
  });

  it("returns services with fallback status and flags Docker integration unavailable when Docker fails", async () => {
    const mockFailingDocker = {
      getContainerStatus: async () => {
        throw new Error("Docker daemon connection failed");
      },
    };

    const app = buildApp({ dockerClient: mockFailingDocker });

    await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "srv-1", externalId: "c-1", integration: "docker" },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/services",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.integrationStatus).toEqual({
      docker: "unavailable",
    });
    expect(body.services).toHaveLength(1);
    expect(body.services[0]).toMatchObject({
      name: "srv-1",
      status: "unknown",
      integration: "docker",
    });
    expect(body.summary).toEqual({
      total: 1,
      online: 0,
      unhealthy: 0,
    });
  });
});

describe("GET /api/services/:id", () => {
  it("returns service details and live CPU, memory, and uptime metrics when container is running", async () => {
    const mockDocker = {
      getContainerStatus: async () => "running" as const,
      getContainerMetrics: async () => ({
        cpuPercent: 12.5,
        memoryUsedBytes: 536870912,
        memoryLimitBytes: 2147483648,
        uptimeSeconds: 86400,
      }),
    };

    const app = buildApp({ dockerClient: mockDocker });

    const createRes = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "jellyfin", externalId: "jellyfin-c", integration: "docker" },
    });
    const created = createRes.json();

    const response = await app.inject({
      method: "GET",
      url: `/api/services/${created.id}`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      id: created.id,
      name: "jellyfin",
      externalId: "jellyfin-c",
      integration: "docker",
      status: "running",
      metrics: {
        available: true,
        cpuPercent: 12.5,
        memoryUsedBytes: 536870912,
        memoryLimitBytes: 2147483648,
        uptimeSeconds: 86400,
      },
    });
  });

  it("returns service details with metrics marked unavailable when container is stopped or unreachable", async () => {
    const mockStoppedDocker = {
      getContainerStatus: async () => "stopped" as const,
    };

    const app = buildApp({ dockerClient: mockStoppedDocker });

    const createRes = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "plex", externalId: "plex-c", integration: "docker" },
    });
    const created = createRes.json();

    const response = await app.inject({
      method: "GET",
      url: `/api/services/${created.id}`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      id: created.id,
      name: "plex",
      status: "stopped",
      metrics: {
        available: false,
        reason: "Container is not running",
      },
    });
  });
});
