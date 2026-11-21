import type { Service, HealthCheckResult } from "./service.ts";
import type { Incident, IncidentStatus } from "./incident.ts";
import type { AuditEntry } from "./operation.ts";

export interface ControlCenterRepository {
  listServices(): Service[];
  getServiceById(id: string): Service | null;
  saveService(service: Service): void;

  addHealthCheck(check: HealthCheckResult): void;
  getHealthChecks(serviceId: string, limit?: number): HealthCheckResult[];

  listIncidents(filter?: { serviceId?: string; status?: IncidentStatus }): Incident[];
  getIncidentById(id: string): Incident | null;
  saveIncident(incident: Incident): void;
  updateIncident(incident: Incident): void;

  addAuditEntry(entry: AuditEntry): void;
  listAuditEntries(filter?: { serviceId?: string }): AuditEntry[];

  setMonitorLink(monitorId: string, serviceId: string): void;
  getMonitorLinks(): Map<string, string>;

  close(): void;
}
