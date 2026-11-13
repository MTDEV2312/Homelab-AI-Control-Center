import crypto from "node:crypto";
import type { ServiceManager } from "./serviceManager.ts";
import type { Incident, CreateIncidentInput } from "../interfaces/incident.ts";

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
}
