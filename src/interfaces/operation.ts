export type OperationAction = "start" | "stop" | "restart";
export type RiskLevel = "L0" | "L1" | "L2" | "L3" | "L4";
export type OperationStatus = "pending" | "executed" | "rejected" | "expired";

export interface PendingOperation {
  id: string;
  serviceId: string;
  action: OperationAction;
  riskLevel: RiskLevel;
  status: OperationStatus;
  expiresAt: string;
  confirmationToken: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: OperationAction;
  riskLevel: RiskLevel;
  serviceId: string;
  outcome: "success" | "failure" | "rejected";
  timestamp: string;
  details?: string;
}
