import type {
  N8nClient,
  N8nWorkflowsResult,
} from "../interfaces/n8n.ts";

export class N8nService {
  private client?: N8nClient;

  constructor(options: { client?: N8nClient } = {}) {
    this.client = options.client;
  }

  async listWorkflows(): Promise<N8nWorkflowsResult> {
    if (!this.client) {
      return {
        integrationStatus: "available",
        summary: { total: 0, active: 0, failedExecutions: 0 },
        workflows: [],
      };
    }

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
  }
}
