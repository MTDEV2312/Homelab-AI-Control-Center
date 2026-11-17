import type { IntegrationHealth } from "./service.ts";

export type N8nExecutionStatus = "success" | "error" | "running" | "waiting" | "canceled";

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  lastExecutionStatus?: N8nExecutionStatus;
  updatedAt?: string;
}

export interface N8nExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: N8nExecutionStatus;
  startedAt: string;
  stoppedAt?: string;
  errorMessage?: string;
}

export interface N8nFailedExecutionFilter {
  workflowId?: string;
  since?: string;
}

export interface N8nClient {
  getWorkflows(): Promise<N8nWorkflow[]>;
  getExecutions?(options?: N8nFailedExecutionFilter): Promise<N8nExecution[]>;
}

export interface N8nWorkflowsResult {
  integrationStatus: IntegrationHealth;
  summary: {
    total: number;
    active: number;
    failedExecutions: number;
  };
  workflows: N8nWorkflow[];
}

export interface N8nFailedExecutionsResult {
  integrationStatus: IntegrationHealth;
  executions: N8nExecution[];
}
