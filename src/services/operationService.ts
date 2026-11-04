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
    actor?: string;
  }): Promise<
    | { operation: PendingOperation }
    | { error: string; code: number }
  > {
    const actor = data.actor || "admin";
    if (!["start", "stop", "restart"].includes(data.action)) {
      return { error: `Invalid action: ${data.action}`, code: 400 };
    }

    const service = await this.serviceManager.getById(data.serviceId);
    if (!service) {
      return { error: "Service not found", code: 404 };
    }

    const riskLevel: RiskLevel = data.action === "stop" ? "L3" : "L2";

    if (service.allowedActions && !service.allowedActions.includes(data.action)) {
      const rejectedAudit: AuditEntry = {
        id: crypto.randomUUID(),
        actor,
        action: data.action,
        riskLevel,
        serviceId: data.serviceId,
        outcome: "rejected",
        timestamp: new Date().toISOString(),
        details: `Action ${data.action} is not permitted by policy for service ${service.name}`,
      };
      this.auditEntries.push(rejectedAudit);
      return {
        error: `Action ${data.action} is not permitted by policy for service ${service.name}`,
        code: 403,
      };
    }

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
    return { operation: pending };
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
