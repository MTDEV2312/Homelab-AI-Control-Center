import { redactLogMessage } from "./serviceManager.ts";
import type {
  N8nClient,
  N8nWorkflowsResult,
  N8nFailedExecutionFilter,
  N8nFailedExecutionsResult,
} from "../interfaces/n8n.ts";

export class N8nService {
  private client?: N8nClient;

  constructor(options: { client?: N8nClient } = {}) {
    this.client = options.client;
  }

  hasClient(): boolean {
    return Boolean(this.client);
  }

  async listWorkflows(): Promise<N8nWorkflowsResult> {
    if (!this.client) {
      return {
        integrationStatus: "available",
        summary: { total: 0, active: 0, failedExecutions: 0 },
        workflows: [],
      };
    }

    try {
      const workflows = await this.client.getWorkflows();
      const executions = this.client.getExecutions
        ? await this.client.getExecutions()
        : [];
      const active = workflows.filter((w) => w.active).length;
      const failedExecutions = executions.filter((e) => e.status === "error").length;

      return {
        integrationStatus: "available",
        summary: {
          total: workflows.length,
          active,
          failedExecutions,
        },
        workflows,
      };
    } catch {
      return {
        integrationStatus: "unavailable",
        summary: { total: 0, active: 0, failedExecutions: 0 },
        workflows: [],
      };
    }
  }

  async listFailedExecutions(
    filter?: N8nFailedExecutionFilter
  ): Promise<N8nFailedExecutionsResult> {
    if (!this.client?.getExecutions) {
      return {
        integrationStatus: "available",
        executions: [],
      };
    }

    try {
      const rawExecutions = await this.client.getExecutions(filter);
      let failed = rawExecutions.filter((e) => e.status === "error");

      if (filter?.workflowId) {
        failed = failed.filter((e) => e.workflowId === filter.workflowId);
      }

      if (filter?.since) {
        const sinceMs = new Date(filter.since).getTime();
        if (!isNaN(sinceMs)) {
          failed = failed.filter((e) => new Date(e.startedAt).getTime() >= sinceMs);
        }
      }

      const executions = failed.map((e) => ({
        ...e,
        ...(e.errorMessage ? { errorMessage: redactLogMessage(e.errorMessage) } : {}),
      }));

      return {
        integrationStatus: "available",
        executions,
      };
    } catch {
      return {
        integrationStatus: "unavailable",
        executions: [],
      };
    }
  }
}
