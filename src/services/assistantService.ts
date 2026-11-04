import type { ToolService } from "./toolService.ts";
import type {
  LlmProvider,
  DiagnosticRequest,
  DiagnosticResponse,
  ToolCallTrace,
  StructuredDiagnosis,
} from "../interfaces/assistant.ts";

export interface AssistantServiceOptions {
  toolService: ToolService;
  llmProvider?: LlmProvider;
  maxIterations?: number;
}

export class AssistantService {
  private toolService: ToolService;
  private llmProvider?: LlmProvider;
  private maxIterations: number;

  constructor(options: AssistantServiceOptions) {
    this.toolService = options.toolService;
    this.llmProvider = options.llmProvider;
    this.maxIterations = options.maxIterations ?? 5;
  }

  async diagnose(request: DiagnosticRequest): Promise<DiagnosticResponse> {
    if (!this.llmProvider) {
      throw new Error("LLM provider is not configured or unavailable");
    }

    const availableTools = this.toolService.getTools();
    const toolTraces: ToolCallTrace[] = [];
    let finalDiagnosis: StructuredDiagnosis | null = null;

    for (let step = 0; step < this.maxIterations; step++) {
      const output = await this.llmProvider.chat({
        query: request.query,
        serviceId: request.serviceId,
        step,
        availableTools,
        toolResults: toolTraces,
      });

      if (output.toolCall) {
        const result = await this.toolService.execute(
          output.toolCall.tool,
          output.toolCall.parameters
        );
        toolTraces.push({
          tool: output.toolCall.tool,
          parameters: output.toolCall.parameters,
          result,
        });
      }

      if (output.diagnosis) {
        finalDiagnosis = output.diagnosis;
        break;
      }
    }

    if (!finalDiagnosis) {
      finalDiagnosis = {
        facts: ["Reached maximum investigation iterations without conclusive model output"],
        hypotheses: [],
        evidence: [],
        recommendations: ["Retry the inquiry or narrow the requested scope"],
      };
    }

    return {
      query: request.query,
      toolTraces,
      diagnosis: finalDiagnosis,
    };
  }
}
