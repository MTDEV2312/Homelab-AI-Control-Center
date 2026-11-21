import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { buildApp } from "../../src/app.ts";
import { SqliteRepository } from "../../src/adapters/sqliteRepository.ts";
import { createAdaptersFromEnv } from "../../src/config/env.ts";

describe("SqliteRepository", () => {
  const tempFiles: string[] = [];

  function createTempDbPath(): string {
    const filePath = path.join(os.tmpdir(), `homelab-test-${crypto.randomUUID()}.sqlite`);
    tempFiles.push(filePath);
    return filePath;
  }

  afterEach(() => {
    for (const base of tempFiles.splice(0, tempFiles.length)) {
      for (const suffix of ["", "-wal", "-shm"]) {
        const target = `${base}${suffix}`;
        if (fs.existsSync(target)) {
          fs.unlinkSync(target);
        }
      }
    }
  });

  it("persists services, health checks, incidents, audit trail, and monitor links across SQLite restarts", async () => {
    const dbPath = createTempDbPath();

    const mockDocker = {
      async getContainerStatus() {
        return "running" as const;
      },
      async checkHealth() {
        return { status: "healthy" as const, latencyMs: 12 };
      },
      async executeContainerAction() {},
    };

    const mockUptimeKuma = {
      async getMonitors() {
        return [
          {
            id: "mon-vw",
            name: "Vaultwarden HTTPS",
            status: "up" as const,
            uptimePercent: 99.9,
            latencyMs: 25,
            heartbeats: [{ status: "up" as const, timestamp: "2026-11-20T20:00:00Z", latencyMs: 25 }],
          },
        ];
      },
    };

    const repo1 = new SqliteRepository(dbPath);
    const app1 = buildApp({
      repository: repo1,
      dockerClient: mockDocker,
      uptimeKumaClient: mockUptimeKuma,
    });

    // 1. Register service
    const srvRes = await app1.inject({
      method: "POST",
      url: "/api/services",
      payload: {
        name: "vaultwarden",
        externalId: "vw-ctr",
        integration: "docker",
        allowedActions: ["restart"],
      },
    });
    const service = srvRes.json();

    // 2. Run health check
    const hcRes = await app1.inject({
      method: "POST",
      url: `/api/services/${service.id}/health-check`,
    });
    expect(hcRes.statusCode).toBe(200);

    // 3. Create & resolve incident
    const incRes = await app1.inject({
      method: "POST",
      url: "/api/incidents",
      payload: {
        serviceId: service.id,
        title: "Database locked",
        severity: "high",
        hypotheses: ["Concurrent backup lock"],
        evidence: ["HTTP 500 on /sync"],
      },
    });
    const incident = incRes.json();

    const patchRes = await app1.inject({
      method: "PATCH",
      url: `/api/incidents/${incident.id}`,
      payload: {
        status: "resolved",
        confirmedCause: "Stuck backup script",
        resolutionNotes: "Killed stale backup job",
        actions: ["restart"],
      },
    });
    expect(patchRes.statusCode).toBe(200);

    // 4. Request & confirm allowed operation + reject disallowed operation
    const reqOpRes = await app1.inject({
      method: "POST",
      url: "/api/operations/request",
      payload: { serviceId: service.id, action: "restart" },
    });
    const { operation } = reqOpRes.json();

    const confirmRes = await app1.inject({
      method: "POST",
      url: `/api/operations/${operation.id}/confirm`,
      payload: { confirmationToken: operation.confirmationToken },
    });
    expect(confirmRes.statusCode).toBe(200);

    const rejectRes = await app1.inject({
      method: "POST",
      url: "/api/operations/request",
      payload: { serviceId: service.id, action: "stop" },
    });
    expect(rejectRes.statusCode).toBe(403);

    // 5. Link Uptime Kuma monitor
    const linkRes = await app1.inject({
      method: "POST",
      url: "/api/uptime-kuma/monitors/mon-vw/link",
      payload: { serviceId: service.id },
    });
    expect(linkRes.statusCode).toBe(200);

    // Close DB and simulate server restart
    repo1.close();

    const repo2 = new SqliteRepository(dbPath);
    try {
      const app2 = buildApp({
        repository: repo2,
        dockerClient: mockDocker,
        uptimeKumaClient: mockUptimeKuma,
      });

      const listServicesRes = await app2.inject({ method: "GET", url: "/api/services" });
      expect(listServicesRes.statusCode).toBe(200);
      const servicesBody = listServicesRes.json();
      expect(servicesBody.services).toHaveLength(1);
      expect(servicesBody.services[0]).toMatchObject({
        id: service.id,
        name: "vaultwarden",
        allowedActions: ["restart"],
      });
      expect(servicesBody.services[0].uptimeKumaMonitor).toMatchObject({
        id: "mon-vw",
        serviceId: service.id,
      });

      const historyRes = await app2.inject({
        method: "GET",
        url: `/api/services/${service.id}/health-checks`,
      });
      expect(historyRes.json().history).toHaveLength(1);
      expect(historyRes.json().history[0].latencyMs).toBe(12);

      const incidentsRes = await app2.inject({
        method: "GET",
        url: `/api/incidents?serviceId=${service.id}`,
      });
      expect(incidentsRes.json()).toHaveLength(1);
      expect(incidentsRes.json()[0]).toMatchObject({
        id: incident.id,
        status: "resolved",
        hypotheses: ["Concurrent backup lock"],
        confirmedCause: "Stuck backup script",
        resolutionNotes: "Killed stale backup job",
      });

      const auditRes = await app2.inject({
        method: "GET",
        url: `/api/audit?serviceId=${service.id}`,
      });
      expect(auditRes.json()).toHaveLength(2);
      expect(auditRes.json().map((e: { outcome: string }) => e.outcome)).toEqual([
        "success",
        "rejected",
      ]);

      const monitorsRes = await app2.inject({ method: "GET", url: "/api/uptime-kuma/monitors" });
      expect(monitorsRes.json().monitors[0].serviceId).toBe(service.id);
    } finally {
      repo2.close();
    }
  });

  it("safely handles SQL injection payloads via parameterized statements", () => {
    const repo = new SqliteRepository(":memory:");
    try {
      const maliciousName = "jellyfin'; DROP TABLE services; --";
      repo.saveService({
        id: "srv-inj",
        name: maliciousName,
        externalId: "jf-ctr",
        integration: "docker",
        createdAt: "2026-11-20T20:00:00Z",
      });

      repo.saveIncident({
        id: "inc-inj",
        serviceId: "srv-inj",
        title: "Test'); DELETE FROM incidents; --",
        severity: "low",
        status: "open",
        startedAt: "2026-11-20T20:01:00Z",
        hypotheses: ["'; DROP TABLE incidents; --"],
        evidence: [],
        actions: [],
      });

      const services = repo.listServices();
      expect(services).toHaveLength(1);
      expect(services[0].name).toBe(maliciousName);

      const incidents = repo.listIncidents();
      expect(incidents).toHaveLength(1);
      expect(incidents[0].hypotheses).toEqual(["'; DROP TABLE incidents; --"]);
    } finally {
      repo.close();
    }
  });

  it("createAdaptersFromEnv wires SqliteRepository when SQLITE_DB_PATH is configured and omits it when unset or placeholder", () => {
    expect(
      createAdaptersFromEnv({ SQLITE_DB_PATH: "your_sqlite_database_file_path_here" }).repository
    ).toBeUndefined();

    const envAdapters = createAdaptersFromEnv({ SQLITE_DB_PATH: ":memory:" });
    try {
      expect(envAdapters.repository).toBeInstanceOf(SqliteRepository);
    } finally {
      envAdapters.repository?.close();
    }
  });
});
