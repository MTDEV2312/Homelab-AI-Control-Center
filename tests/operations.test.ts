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

describe("POST /api/operations/:id/confirm", () => {
  it("executes container action, updates service status, and logs audit entry", async () => {
    let executedAction: { containerId: string; action: string } | null = null;
    let containerStatus: "running" | "stopped" = "running";

    const mockDocker = {
      getContainerStatus: async () => containerStatus,
      executeContainerAction: async (containerId: string, action: string) => {
        executedAction = { containerId, action };
        if (action === "stop") containerStatus = "stopped";
        if (action === "start" || action === "restart") containerStatus = "running";
      },
    };

    const app = buildApp({ dockerClient: mockDocker });

    const srvRes = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "vaultwarden", externalId: "vw-ctr", integration: "docker" },
    });
    const service = srvRes.json();

    const reqRes = await app.inject({
      method: "POST",
      url: "/api/operations/request",
      payload: { serviceId: service.id, action: "restart" },
    });
    const { operation } = reqRes.json();

    const confirmRes = await app.inject({
      method: "POST",
      url: `/api/operations/${operation.id}/confirm`,
      payload: { confirmationToken: operation.confirmationToken },
    });

    expect(confirmRes.statusCode).toBe(200);
    const body = confirmRes.json();
    expect(body.status).toBe("executed");
    expect(body.operation.status).toBe("executed");
    expect(body.auditEntry).toMatchObject({
      action: "restart",
      riskLevel: "L2",
      serviceId: service.id,
      outcome: "success",
    });
    expect(body.auditEntry.timestamp).toBeDefined();

    expect(executedAction).toEqual({
      containerId: "vw-ctr",
      action: "restart",
    });

    const statusRes = await app.inject({
      method: "GET",
      url: `/api/services/${service.id}`,
    });
    expect(statusRes.json().status).toBe("running");
  });

  it("rejects unconfirmed, reused confirmation, or unallowed service actions and records rejection in audit log", async () => {
    let callCount = 0;
    const mockDocker = {
      getContainerStatus: async () => "running" as const,
      executeContainerAction: async () => {
        callCount++;
      },
    };

    const app = buildApp({ dockerClient: mockDocker });

    const srvRes = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "pihole", externalId: "pihole-ctr", integration: "docker" },
    });
    const service = srvRes.json();

    const reqRes = await app.inject({
      method: "POST",
      url: "/api/operations/request",
      payload: { serviceId: service.id, action: "restart" },
    });
    const { operation } = reqRes.json();

    // 1. Wrong token rejected
    const badTokenRes = await app.inject({
      method: "POST",
      url: `/api/operations/${operation.id}/confirm`,
      payload: { confirmationToken: "invalid-token" },
    });
    expect(badTokenRes.statusCode).toBe(403);
    expect(callCount).toBe(0);

    // 2. Valid confirmation executes
    const okConfirm = await app.inject({
      method: "POST",
      url: `/api/operations/${operation.id}/confirm`,
      payload: { confirmationToken: operation.confirmationToken },
    });
    expect(okConfirm.statusCode).toBe(200);
    expect(callCount).toBe(1);

    // 3. Reused token rejected
    const reusedRes = await app.inject({
      method: "POST",
      url: `/api/operations/${operation.id}/confirm`,
      payload: { confirmationToken: operation.confirmationToken },
    });
    expect(reusedRes.statusCode).toBe(400);
    expect(callCount).toBe(1);

    // 4. Policy check: action not allowed for restricted service
    const restrictedSrvRes = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: {
        name: "cloudflared",
        externalId: "cf-ctr",
        integration: "docker",
        allowedActions: ["restart"],
      },
    });
    const restrictedService = restrictedSrvRes.json();

    const unallowedActionRes = await app.inject({
      method: "POST",
      url: "/api/operations/request",
      payload: { serviceId: restrictedService.id, action: "stop" },
    });
    expect(unallowedActionRes.statusCode).toBe(403);
    expect(unallowedActionRes.json().error).toContain("Action stop is not permitted by policy");
  });
});

describe("GET /api/audit", () => {
  it("returns chronological audit trail filtered or scoped to service operations", async () => {
    const mockDocker = {
      getContainerStatus: async () => "running" as const,
      executeContainerAction: async () => {},
    };

    const app = buildApp({ dockerClient: mockDocker });

    const s1Res = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "service-1", externalId: "c-1", integration: "docker" },
    });
    const s1 = s1Res.json();

    const s2Res = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "service-2", externalId: "c-2", integration: "docker" },
    });
    const s2 = s2Res.json();

    const req1 = await app.inject({
      method: "POST",
      url: "/api/operations/request",
      payload: { serviceId: s1.id, action: "restart" },
    });
    const op1 = req1.json().operation;
    await app.inject({
      method: "POST",
      url: `/api/operations/${op1.id}/confirm`,
      payload: { confirmationToken: op1.confirmationToken },
    });

    const req2 = await app.inject({
      method: "POST",
      url: "/api/operations/request",
      payload: { serviceId: s2.id, action: "stop" },
    });
    const op2 = req2.json().operation;
    await app.inject({
      method: "POST",
      url: `/api/operations/${op2.id}/confirm`,
      payload: { confirmationToken: "wrong-token" },
    });

    const req3 = await app.inject({
      method: "POST",
      url: "/api/operations/request",
      payload: { serviceId: s1.id, action: "stop" },
    });
    const op3 = req3.json().operation;
    await app.inject({
      method: "POST",
      url: `/api/operations/${op3.id}/confirm`,
      payload: { confirmationToken: op3.confirmationToken },
    });

    const allAuditRes = await app.inject({
      method: "GET",
      url: "/api/audit",
    });
    expect(allAuditRes.statusCode).toBe(200);
    const allEntries = allAuditRes.json();
    expect(allEntries).toHaveLength(3);
    expect(allEntries[0].serviceId).toBe(s1.id);
    expect(allEntries[0].action).toBe("restart");
    expect(allEntries[1].serviceId).toBe(s2.id);
    expect(allEntries[1].outcome).toBe("rejected");
    expect(allEntries[2].serviceId).toBe(s1.id);
    expect(allEntries[2].action).toBe("stop");

    const s1AuditRes = await app.inject({
      method: "GET",
      url: `/api/audit?serviceId=${s1.id}`,
    });
    expect(s1AuditRes.statusCode).toBe(200);
    const s1Entries = s1AuditRes.json();
    expect(s1Entries).toHaveLength(2);
    expect(s1Entries.every((e: any) => e.serviceId === s1.id)).toBe(true);
  });
});


