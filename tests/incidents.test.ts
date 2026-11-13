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

describe("GET /api/incidents", () => {
  it("lists incidents with optional serviceId and status filtering", async () => {
    const app = buildApp();

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

    await app.inject({
      method: "POST",
      url: "/api/incidents",
      payload: {
        serviceId: s1.id,
        title: "Database connection failed",
        severity: "critical",
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/incidents",
      payload: {
        serviceId: s2.id,
        title: "DNS lookup timeout",
        severity: "medium",
      },
    });

    // 1. Unfiltered query returns all
    const allRes = await app.inject({
      method: "GET",
      url: "/api/incidents",
    });
    expect(allRes.statusCode).toBe(200);
    const allIncidents = allRes.json();
    expect(allIncidents).toHaveLength(2);

    // 2. Filter by serviceId
    const s1ResFilter = await app.inject({
      method: "GET",
      url: `/api/incidents?serviceId=${s1.id}`,
    });
    expect(s1ResFilter.statusCode).toBe(200);
    const s1Incidents = s1ResFilter.json();
    expect(s1Incidents).toHaveLength(1);
    expect(s1Incidents[0].serviceId).toBe(s1.id);
    expect(s1Incidents[0].title).toBe("Database connection failed");

    // 3. Filter by status
    const openRes = await app.inject({
      method: "GET",
      url: "/api/incidents?status=open",
    });
    expect(openRes.statusCode).toBe(200);
    expect(openRes.json()).toHaveLength(2);

    const resolvedRes = await app.inject({
      method: "GET",
      url: "/api/incidents?status=resolved",
    });
    expect(resolvedRes.statusCode).toBe(200);
    expect(resolvedRes.json()).toHaveLength(0);
  });
});

describe("PATCH /api/incidents/:id", () => {
  it("updates incident status, records confirmed root cause distinct from hypotheses, and sets resolvedAt timestamp on resolution", async () => {
    const app = buildApp();

    const srvRes = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "vaultwarden", externalId: "vw-ctr", integration: "docker" },
    });
    const service = srvRes.json();

    const createRes = await app.inject({
      method: "POST",
      url: "/api/incidents",
      payload: {
        serviceId: service.id,
        title: "Vault synchronization locked",
        severity: "high",
        hypotheses: ["SQLite database locked by concurrent backup", "Corrupted index"],
      },
    });
    const incident = createRes.json();

    // 1. Transition to investigating and add evidence
    const patchInvestigating = await app.inject({
      method: "PATCH",
      url: `/api/incidents/${incident.id}`,
      payload: {
        status: "investigating",
        evidence: ["Found stuck backup cron job holding db lock"],
      },
    });

    expect(patchInvestigating.statusCode).toBe(200);
    const bodyInv = patchInvestigating.json();
    expect(bodyInv.status).toBe("investigating");
    expect(bodyInv.hypotheses).toEqual([
      "SQLite database locked by concurrent backup",
      "Corrupted index",
    ]);
    expect(bodyInv.evidence).toEqual(["Found stuck backup cron job holding db lock"]);
    expect(bodyInv.resolvedAt).toBeUndefined();

    // 2. Resolve incident with confirmedCause and resolutionNotes
    const patchResolved = await app.inject({
      method: "PATCH",
      url: `/api/incidents/${incident.id}`,
      payload: {
        status: "resolved",
        confirmedCause: "Stuck backup script held exclusive lock on sqlite file",
        resolutionNotes: "Killed stuck cron process and restarted container",
        actions: ["kill 4521", "restart"],
      },
    });

    expect(patchResolved.statusCode).toBe(200);
    const bodyResolved = patchResolved.json();
    expect(bodyResolved.status).toBe("resolved");
    expect(bodyResolved.resolvedAt).toBeDefined();
    expect(bodyResolved.confirmedCause).toBe("Stuck backup script held exclusive lock on sqlite file");
    expect(bodyResolved.resolutionNotes).toBe("Killed stuck cron process and restarted container");
    expect(bodyResolved.actions).toEqual(["kill 4521", "restart"]);
    // Ensure hypotheses remain intact and separate from confirmed cause
    expect(bodyResolved.hypotheses).toEqual([
      "SQLite database locked by concurrent backup",
      "Corrupted index",
    ]);

    // 3. Rejects unknown incident ID
    const notFoundRes = await app.inject({
      method: "PATCH",
      url: "/api/incidents/non-existent-id",
      payload: { status: "mitigated" },
    });
    expect(notFoundRes.statusCode).toBe(404);
  });
});


