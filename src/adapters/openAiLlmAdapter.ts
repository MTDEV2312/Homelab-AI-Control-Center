import type { LlmChatInput, LlmChatOutput, LlmProvider } from "../interfaces/assistant.ts";

export interface OpenAiLlmAdapterOptions {
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
}

const SYSTEM_PROMPT =
  "You are a homelab diagnostics assistant. Respond with strict JSON matching {\"diagnosis\":{\"facts\":string[],\"hypotheses\":string[],\"evidence\":string[],\"recommendations\":string[]}}.";

/** OpenAI-compatible /v1/chat/completions LLM provider adapter. */
export class OpenAiLlmAdapter implements LlmProvider {
  private endpointUrl: string;
  private model: string;
  private apiKey?: string;

  constructor(options: OpenAiLlmAdapterOptions) {
    const cleanBase = options.baseUrl.trim().replace(/\/+$/, "");
    this.endpointUrl = cleanBase.endsWith("/v1")
      ? `${cleanBase}/chat/completions`
      : `${cleanBase}/v1/chat/completions`;
    this.model = options.model.trim();
    this.apiKey = options.apiKey?.trim();
  }

  async chat(input: LlmChatInput): Promise<LlmChatOutput> {
    const response = await fetch(this.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ query: input.query, serviceId: input.serviceId }) },
        ],
      }),
    });

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as LlmChatOutput;
    return { diagnosis: parsed.diagnosis };
  }
}
