export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "mitigated" | "resolved";

export interface Incident {
  id: string;
  serviceId: string;
  title: string;
  description?: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  startedAt: string;
  resolvedAt?: string;
  hypotheses: string[];
  evidence: string[];
  actions: string[];
  confirmedCause?: string;
  resolutionNotes?: string;
}

export interface CreateIncidentInput {
  serviceId: string;
  title: string;
  severity: IncidentSeverity;
  description?: string;
  hypotheses?: string[];
  evidence?: string[];
  actions?: string[];
}
