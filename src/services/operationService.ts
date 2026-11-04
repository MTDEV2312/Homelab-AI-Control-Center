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
}
