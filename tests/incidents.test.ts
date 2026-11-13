import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.ts";

describe("POST /api/incidents", () => {
  it("creates open incident linked to service with severity, timestamps, hypotheses, and evidence", async () => {
    const app = buildApp();

    const srvRes = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "jellyfin", externalId: "jellyfin-ctr", integration: "docker" },
    });
    const service = srvRes.json();

    const incidentPayload = {
      serviceId: service.id,
      title: "High CPU and 502 gateway errors",
      severity: "high",
      description: "Container jellyfin unreachable from reverse proxy",
      hypotheses: ["Transcoder memory leak", "OOM killed child process"],
      evidence: ["CPU at 98%", "Log error: gateway timeout 502"],
      actions: ["restart"],
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/incidents",
      payload: incidentPayload,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({
      serviceId: service.id,
      title: "High CPU and 502 gateway errors",
      severity: "high",
      status: "open",
      description: "Container jellyfin unreachable from reverse proxy",
      hypotheses: ["Transcoder memory leak", "OOM killed child process"],
      evidence: ["CPU at 98%", "Log error: gateway timeout 502"],
      actions: ["restart"],
    });
    expect(body.id).toBeDefined();
    expect(body.startedAt).toBeDefined();
    expect(body.resolvedAt).toBeUndefined();

    // Rejects non-existent service
    const notFoundRes = await app.inject({
      method: "POST",
      url: "/api/incidents",
      payload: {
        ...incidentPayload,
        serviceId: "non-existent-id",
      },
    });
    expect(notFoundRes.statusCode).toBe(404);
  });
});
