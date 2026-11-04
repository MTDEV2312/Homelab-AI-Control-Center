import crypto from "node:crypto";
import type { ServiceManager } from "./serviceManager.ts";
import type {
  PendingOperation,
  OperationAction,
  RiskLevel,
  AuditEntry,
} from "../interfaces/operation.ts";

export class OperationService {
  private serviceManager: ServiceManager;
  private pendingOperations: Map<string, PendingOperation> = new Map();
  private auditEntries: AuditEntry[] = [];

  constructor(serviceManager: ServiceManager) {
    this.serviceManager = serviceManager;
  }

  async requestOperation(data: {
    serviceId: string;
    action: OperationAction;
  }): Promise<PendingOperation | null> {
    const service = await this.serviceManager.getById(data.serviceId);
    if (!service) {
      return null;
    }

    const riskLevel: RiskLevel = data.action === "stop" ? "L3" : "L2";
    const id = crypto.randomUUID();
    const confirmationToken = crypto.randomBytes(16).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

    const pending: PendingOperation = {
      id,
      serviceId: data.serviceId,
      action: data.action,
      riskLevel,
      status: "pending",
      expiresAt,
      confirmationToken,
      createdAt: now.toISOString(),
    };

    this.pendingOperations.set(id, pending);
    return pending;
  }

  async confirmOperation(
    id: string,
    token: string,
    actor: string = "admin"
  ): Promise<
    | { status: "executed" | "rejected"; operation: PendingOperation; auditEntry: AuditEntry }
    | { error: string; code: number }
  > {
    const op = this.pendingOperations.get(id);
    if (!op) {
      return { error: "Operation not found", code: 404 };
    }

    if (op.status !== "pending") {
      const rejectedAudit: AuditEntry = {
        id: crypto.randomUUID(),
        actor,
        action: op.action,
        riskLevel: op.riskLevel,
        serviceId: op.serviceId,
        outcome: "rejected",
        timestamp: new Date().toISOString(),
        details: `Operation is already ${op.status}`,
      };
      this.auditEntries.push(rejectedAudit);
      return { error: `Operation is already ${op.status}`, code: 400 };
    }

    if (op.confirmationToken !== token) {
      const rejectedAudit: AuditEntry = {
        id: crypto.randomUUID(),
        actor,
        action: op.action,
        riskLevel: op.riskLevel,
        serviceId: op.serviceId,
        outcome: "rejected",
        timestamp: new Date().toISOString(),
        details: "Invalid confirmation token",
      };
      this.auditEntries.push(rejectedAudit);
      return { error: "Invalid confirmation token", code: 403 };
    }

    await this.serviceManager.executeServiceAction(op.serviceId, op.action);

    op.status = "executed";
    const auditEntry: AuditEntry = {
      id: crypto.randomUUID(),
      actor,
      action: op.action,
      riskLevel: op.riskLevel,
      serviceId: op.serviceId,
      outcome: "success",
      timestamp: new Date().toISOString(),
    };
    this.auditEntries.push(auditEntry);

    return {
      status: "executed",
      operation: op,
      auditEntry,
    };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditEntries];
  }
}
