import type { N8nClient, N8nWorkflow } from "../interfaces/n8n.ts";

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

/** HTTP adapter reading workflows from the n8n REST API. */
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
}
