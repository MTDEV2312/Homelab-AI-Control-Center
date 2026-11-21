import crypto from "node:crypto";
import type { ServiceManager } from "./serviceManager.ts";
import type { Incident, CreateIncidentInput, UpdateIncidentInput, IncidentStatus } from "../interfaces/incident.ts";
import type { ControlCenterRepository } from "../interfaces/repository.ts";

export class IncidentService {
  private serviceManager: ServiceManager;
  private incidents: Incident[] = [];
  private repository?: ControlCenterRepository;

  constructor(serviceManager: ServiceManager, repository?: ControlCenterRepository) {
    this.serviceManager = serviceManager;
    this.repository = repository;
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

    if (this.repository) {
      this.repository.saveIncident(incident);
    } else {
      this.incidents.push(incident);
    }
    return incident;
  }

  list(options?: { serviceId?: string; status?: IncidentStatus }): Incident[] {
    if (this.repository) {
      return this.repository.listIncidents(options);
    }

    let result = [...this.incidents];
    if (options?.serviceId) {
      result = result.filter((inc) => inc.serviceId === options.serviceId);
    }
    if (options?.status) {
      result = result.filter((inc) => inc.status === options.status);
    }
    return result;
  }

  update(id: string, input: UpdateIncidentInput): Incident | null {
    const incident = this.repository
      ? this.repository.getIncidentById(id)
      : (this.incidents.find((inc) => inc.id === id) ?? null);
    if (!incident) {
      return null;
    }

    if (input.status !== undefined) {
      incident.status = input.status;
      if (input.status === "resolved") {
        if (!incident.resolvedAt) {
          incident.resolvedAt = new Date().toISOString();
        }
      } else {
        incident.resolvedAt = undefined;
      }
    }

    if (input.description !== undefined) {
      incident.description = input.description;
    }

    if (input.hypotheses !== undefined) {
      incident.hypotheses = input.hypotheses;
    }

    if (input.evidence !== undefined) {
      incident.evidence = input.evidence;
    }

    if (input.actions !== undefined) {
      incident.actions = input.actions;
    }

    if (input.confirmedCause !== undefined) {
      incident.confirmedCause = input.confirmedCause;
    }

    if (input.resolutionNotes !== undefined) {
      incident.resolutionNotes = input.resolutionNotes;
    }

    if (this.repository) {
      this.repository.updateIncident(incident);
    }

    return incident;
  }
}
