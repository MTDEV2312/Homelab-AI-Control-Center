import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ControlCenterRepository } from "../interfaces/repository.ts";
import type { HealthCheckResult, HealthStatus, Service } from "../interfaces/service.ts";
import type { Incident, IncidentSeverity, IncidentStatus } from "../interfaces/incident.ts";
import type { AuditEntry, OperationAction, RiskLevel } from "../interfaces/operation.ts";

function mapServiceRow(row: Record<string, unknown>): Service {
  const allowedRaw = row.allowed_actions;
  const allowedActions =
    typeof allowedRaw === "string" ? (JSON.parse(allowedRaw) as OperationAction[]) : undefined;

  return {
    id: String(row.id),
    name: String(row.name),
    externalId: String(row.external_id),
    integration: String(row.integration),
    ...(allowedActions !== undefined ? { allowedActions } : {}),
    createdAt: String(row.created_at),
  };
}

function mapHealthCheckRow(row: Record<string, unknown>): HealthCheckResult {
  const errorCode = typeof row.error_code === "string" ? row.error_code : undefined;

  return {
    id: String(row.id),
    serviceId: String(row.service_id),
    status: String(row.status) as HealthStatus,
    latencyMs: Number(row.latency_ms),
    checkedAt: String(row.checked_at),
    ...(errorCode !== undefined ? { errorCode } : {}),
  };
}

function mapIncidentRow(row: Record<string, unknown>): Incident {
  return {
    id: String(row.id),
    serviceId: String(row.service_id),
    title: String(row.title),
    ...(typeof row.description === "string" ? { description: row.description } : {}),
    severity: String(row.severity) as IncidentSeverity,
    status: String(row.status) as IncidentStatus,
    startedAt: String(row.started_at),
    ...(typeof row.resolved_at === "string" ? { resolvedAt: row.resolved_at } : {}),
    hypotheses: JSON.parse(String(row.hypotheses)) as string[],
    evidence: JSON.parse(String(row.evidence)) as string[],
    actions: JSON.parse(String(row.actions)) as string[],
    ...(typeof row.confirmed_cause === "string" ? { confirmedCause: row.confirmed_cause } : {}),
    ...(typeof row.resolution_notes === "string"
      ? { resolutionNotes: row.resolution_notes }
      : {}),
  };
}

function mapAuditRow(row: Record<string, unknown>): AuditEntry {
  return {
    id: String(row.id),
    actor: String(row.actor),
    action: String(row.action) as OperationAction,
    riskLevel: String(row.risk_level) as RiskLevel,
    serviceId: String(row.service_id),
    outcome: String(row.outcome) as AuditEntry["outcome"],
    timestamp: String(row.timestamp),
    ...(typeof row.details === "string" ? { details: row.details } : {}),
  };
}

export class SqliteRepository implements ControlCenterRepository {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA foreign_keys = ON;");
    if (dbPath !== ":memory:") {
      this.db.exec("PRAGMA journal_mode = WAL;");
    }

    this.migrate();
  }

  private migrate(): void {
    const versionRow = this.db.prepare("PRAGMA user_version;").get() as
      | Record<string, unknown>
      | undefined;
    const currentVersion = Number(versionRow?.user_version ?? 0);

    if (currentVersion < 1) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS services (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          external_id TEXT NOT NULL,
          integration TEXT NOT NULL,
          allowed_actions TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS health_checks (
          id TEXT PRIMARY KEY,
          service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
          status TEXT NOT NULL,
          latency_ms INTEGER NOT NULL,
          checked_at TEXT NOT NULL,
          error_code TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_health_checks_service_time
          ON health_checks(service_id, checked_at);

        CREATE TABLE IF NOT EXISTS incidents (
          id TEXT PRIMARY KEY,
          service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          severity TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          resolved_at TEXT,
          hypotheses TEXT NOT NULL,
          evidence TEXT NOT NULL,
          actions TEXT NOT NULL,
          confirmed_cause TEXT,
          resolution_notes TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_incidents_service_status
          ON incidents(service_id, status);

        CREATE TABLE IF NOT EXISTS audit_entries (
          id TEXT PRIMARY KEY,
          actor TEXT NOT NULL,
          action TEXT NOT NULL,
          risk_level TEXT NOT NULL,
          service_id TEXT NOT NULL,
          outcome TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          details TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_audit_entries_service_time
          ON audit_entries(service_id, timestamp);

        CREATE TABLE IF NOT EXISTS monitor_links (
          monitor_id TEXT PRIMARY KEY,
          service_id TEXT NOT NULL UNIQUE REFERENCES services(id) ON DELETE CASCADE
        );

        PRAGMA user_version = 1;
      `);
    }
  }

  listServices(): Service[] {
    const rows = this.db
      .prepare(
        "SELECT id, name, external_id, integration, allowed_actions, created_at FROM services ORDER BY rowid ASC"
      )
      .all() as Record<string, unknown>[];
    return rows.map(mapServiceRow);
  }

  getServiceById(id: string): Service | null {
    const row = this.db
      .prepare(
        "SELECT id, name, external_id, integration, allowed_actions, created_at FROM services WHERE id = ?"
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapServiceRow(row) : null;
  }

  saveService(service: Service): void {
    this.db
      .prepare(
        `INSERT INTO services (id, name, external_id, integration, allowed_actions, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        service.id,
        service.name,
        service.externalId,
        service.integration,
        service.allowedActions ? JSON.stringify(service.allowedActions) : null,
        service.createdAt
      );
  }

  addHealthCheck(check: HealthCheckResult): void {
    this.db
      .prepare(
        `INSERT INTO health_checks (id, service_id, status, latency_ms, checked_at, error_code)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        check.id,
        check.serviceId,
        check.status,
        check.latencyMs,
        check.checkedAt,
        check.errorCode ?? null
      );
  }

  getHealthChecks(serviceId: string, limit?: number): HealthCheckResult[] {
    if (limit !== undefined) {
      const rows = this.db
        .prepare(
          `SELECT id, service_id, status, latency_ms, checked_at, error_code
           FROM health_checks
           WHERE service_id = ?
           ORDER BY rowid DESC
           LIMIT ?`
        )
        .all(serviceId, limit) as Record<string, unknown>[];
      return rows.reverse().map(mapHealthCheckRow);
    }

    const rows = this.db
      .prepare(
        `SELECT id, service_id, status, latency_ms, checked_at, error_code
         FROM health_checks
         WHERE service_id = ?
         ORDER BY rowid ASC`
      )
      .all(serviceId) as Record<string, unknown>[];
    return rows.map(mapHealthCheckRow);
  }

  listIncidents(filter?: { serviceId?: string; status?: IncidentStatus }): Incident[] {
    const clauses: string[] = [];
    const params: string[] = [];

    if (filter?.serviceId) {
      clauses.push("service_id = ?");
      params.push(filter.serviceId);
    }
    if (filter?.status) {
      clauses.push("status = ?");
      params.push(filter.status);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(
        `SELECT id, service_id, title, description, severity, status, started_at, resolved_at,
                hypotheses, evidence, actions, confirmed_cause, resolution_notes
         FROM incidents
         ${where}
         ORDER BY rowid ASC`
      )
      .all(...params) as Record<string, unknown>[];

    return rows.map(mapIncidentRow);
  }

  getIncidentById(id: string): Incident | null {
    const row = this.db
      .prepare(
        `SELECT id, service_id, title, description, severity, status, started_at, resolved_at,
                hypotheses, evidence, actions, confirmed_cause, resolution_notes
         FROM incidents
         WHERE id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapIncidentRow(row) : null;
  }

  saveIncident(incident: Incident): void {
    this.db
      .prepare(
        `INSERT INTO incidents (
           id, service_id, title, description, severity, status, started_at, resolved_at,
           hypotheses, evidence, actions, confirmed_cause, resolution_notes
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        incident.id,
        incident.serviceId,
        incident.title,
        incident.description ?? null,
        incident.severity,
        incident.status,
        incident.startedAt,
        incident.resolvedAt ?? null,
        JSON.stringify(incident.hypotheses),
        JSON.stringify(incident.evidence),
        JSON.stringify(incident.actions),
        incident.confirmedCause ?? null,
        incident.resolutionNotes ?? null
      );
  }

  updateIncident(incident: Incident): void {
    this.db
      .prepare(
        `UPDATE incidents
         SET description = ?, status = ?, resolved_at = ?, hypotheses = ?, evidence = ?,
             actions = ?, confirmed_cause = ?, resolution_notes = ?
         WHERE id = ?`
      )
      .run(
        incident.description ?? null,
        incident.status,
        incident.resolvedAt ?? null,
        JSON.stringify(incident.hypotheses),
        JSON.stringify(incident.evidence),
        JSON.stringify(incident.actions),
        incident.confirmedCause ?? null,
        incident.resolutionNotes ?? null,
        incident.id
      );
  }

  addAuditEntry(entry: AuditEntry): void {
    this.db
      .prepare(
        `INSERT INTO audit_entries (id, actor, action, risk_level, service_id, outcome, timestamp, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.id,
        entry.actor,
        entry.action,
        entry.riskLevel,
        entry.serviceId,
        entry.outcome,
        entry.timestamp,
        entry.details ?? null
      );
  }

  listAuditEntries(filter?: { serviceId?: string }): AuditEntry[] {
    if (filter?.serviceId) {
      const rows = this.db
        .prepare(
          `SELECT id, actor, action, risk_level, service_id, outcome, timestamp, details
           FROM audit_entries
           WHERE service_id = ?
           ORDER BY rowid ASC`
        )
        .all(filter.serviceId) as Record<string, unknown>[];
      return rows.map(mapAuditRow);
    }

    const rows = this.db
      .prepare(
        `SELECT id, actor, action, risk_level, service_id, outcome, timestamp, details
         FROM audit_entries
         ORDER BY rowid ASC`
      )
      .all() as Record<string, unknown>[];
    return rows.map(mapAuditRow);
  }

  setMonitorLink(monitorId: string, serviceId: string): void {
    this.db
      .prepare("DELETE FROM monitor_links WHERE service_id = ? OR monitor_id = ?")
      .run(serviceId, monitorId);
    this.db
      .prepare("INSERT INTO monitor_links (monitor_id, service_id) VALUES (?, ?)")
      .run(monitorId, serviceId);
  }

  getMonitorLinks(): Map<string, string> {
    const rows = this.db
      .prepare("SELECT monitor_id, service_id FROM monitor_links")
      .all() as Record<string, unknown>[];
    const links = new Map<string, string>();
    for (const row of rows) {
      links.set(String(row.monitor_id), String(row.service_id));
    }
    return links;
  }

  close(): void {
    this.db.close();
  }
}
