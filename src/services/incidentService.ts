import crypto from "node:crypto";
import type { ServiceManager } from "./serviceManager.ts";
import type { Incident, CreateIncidentInput, IncidentStatus } from "../interfaces/incident.ts";

export class IncidentService {
  private serviceManager: ServiceManager;
  private incidents: Incident[] = [];

  constructor(serviceManager: ServiceManager) {
    this.serviceManager = serviceManager;
  }

  async create(input: CreateIncidentInput): Promise<Incident | null> {
    const service = await this.serviceManager.getById(input.serviceId);
    if (!service) {
      return null;
    }

    const incident: Incident = {
      id: crypto.randomUUID(),
      serviceId: input.serviceId,
      title: input.title,
      severity: input.severity,
      status: "open",
      description: input.description,
      startedAt: new Date().toISOString(),
      hypotheses: input.hypotheses ?? [],
      evidence: input.evidence ?? [],
      actions: input.actions ?? [],
    };

    this.incidents.push(incident);
    return incident;
  }

  list(options?: { serviceId?: string; status?: IncidentStatus }): Incident[] {
    let result = [...this.incidents];
    if (options?.serviceId) {
      result = result.filter((inc) => inc.serviceId === options.serviceId);
    }
    if (options?.status) {
      result = result.filter((inc) => inc.status === options.status);
    }
    return result;
  }
}
