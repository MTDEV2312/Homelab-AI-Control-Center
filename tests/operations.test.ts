import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.ts";

describe("POST /api/operations/request", () => {
  it("creates pending operation with assigned risk level (L2 start/restart, L3 stop)", async () => {
    const app = buildApp();

    const srvRes = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "pihole", externalId: "pihole-ctr", integration: "docker" },
    });
    const service = srvRes.json();

    // 1. Request restart -> L2
    const resRestart = await app.inject({
      method: "POST",
      url: "/api/operations/request",
      payload: {
        serviceId: service.id,
        action: "restart",
      },
    });

    expect(resRestart.statusCode).toBe(201);
    const bodyRestart = resRestart.json();
    expect(bodyRestart.operation).toMatchObject({
      serviceId: service.id,
      action: "restart",
      riskLevel: "L2",
      status: "pending",
    });
    expect(bodyRestart.operation.id).toBeDefined();
    expect(bodyRestart.operation.confirmationToken).toBeDefined();

    // 2. Request stop -> L3
    const resStop = await app.inject({
      method: "POST",
      url: "/api/operations/request",
      payload: {
        serviceId: service.id,
        action: "stop",
      },
    });

    expect(resStop.statusCode).toBe(201);
    const bodyStop = resStop.json();
    expect(bodyStop.operation).toMatchObject({
      serviceId: service.id,
      action: "stop",
      riskLevel: "L3",
      status: "pending",
    });
  });
});
