import type { ToolDefinition } from "./tool.ts";

export interface ToolCallProposal {
  tool: string;
  parameters: Record<string, any>;
}

export interface ToolCallTrace {
  tool: string;
  parameters: Record<string, any>;
  result?: any;
  error?: string;
}

export interface StructuredDiagnosis {
  facts: string[];
  hypotheses: string[];
  evidence: string[];
  recommendations: string[];
}

export interface LlmChatInput {
  query: string;
  serviceId?: string;
  step: number;
  availableTools: ToolDefinition[];
  toolResults: ToolCallTrace[];
}

export interface LlmChatOutput {
  toolCall?: ToolCallProposal;
  diagnosis?: StructuredDiagnosis;
}

export interface LlmProvider {
  chat(input: LlmChatInput): Promise<LlmChatOutput>;
}

export interface DiagnosticRequest {
  query: string;
  serviceId?: string;
}

export interface DiagnosticResponse {
  query: string;
  toolTraces: ToolCallTrace[];
  diagnosis: StructuredDiagnosis;
}
