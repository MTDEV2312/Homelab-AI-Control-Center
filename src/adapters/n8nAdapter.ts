import type {
  N8nClient,
  N8nExecution,
  N8nExecutionStatus,
  N8nWorkflow,
} from "../interfaces/n8n.ts";

export interface N8nAdapterOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

interface RawN8nWorkflow {
  id: string | number;
  name: string;
  active?: boolean;
  updatedAt?: string;
}

interface RawN8nExecution {
  id: string | number;
  workflowId: string | number;
  status?: string;
  startedAt: string;
  stoppedAt?: string;
  workflowData?: { name?: string };
  data?: { resultData?: { error?: { message?: string } } };
  error?: { message?: string };
}

const EXECUTION_STATUS_MAP: Record<string, N8nExecutionStatus> = {
  success: "success",
  error: "error",
  crashed: "error",
  running: "running",
  waiting: "waiting",
  canceled: "canceled",
};

/** HTTP adapter reading workflows and executions from the n8n REST API. */
export class N8nAdapter implements N8nClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(options: N8nAdapterOptions) {
    this.baseUrl = options.baseUrl.trim().replace(/\/+$/, "");
    this.apiKey = options.apiKey.trim();
  }

  async getWorkflows(): Promise<N8nWorkflow[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/workflows`, {
      headers: { "X-N8N-API-KEY": this.apiKey },
    });
    const body = (await response.json()) as { data?: RawN8nWorkflow[] };

    return (body.data ?? []).map((wf) => ({
      id: String(wf.id),
      name: wf.name,
      active: Boolean(wf.active),
      ...(wf.updatedAt ? { updatedAt: wf.updatedAt } : {}),
    }));
  }

  async getExecutions(): Promise<N8nExecution[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/executions?includeData=true`, {
      headers: { "X-N8N-API-KEY": this.apiKey },
    });
    const body = (await response.json()) as { data?: RawN8nExecution[] };

    return (body.data ?? []).map((ex) => {
      const errorMessage = ex.data?.resultData?.error?.message ?? ex.error?.message;
      const status = (ex.status ? EXECUTION_STATUS_MAP[ex.status] : undefined) ?? "waiting";

      return {
        id: String(ex.id),
        workflowId: String(ex.workflowId),
        workflowName: ex.workflowData?.name ?? String(ex.workflowId),
        status,
        startedAt: ex.startedAt,
        ...(ex.stoppedAt ? { stoppedAt: ex.stoppedAt } : {}),
        ...(errorMessage ? { errorMessage } : {}),
      };
    });
  }
}
