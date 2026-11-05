import type { ToolService } from "./toolService.ts";
import type { OperationService } from "./operationService.ts";
import { redactLogMessage } from "./serviceManager.ts";
import type {
  LlmProvider,
  DiagnosticRequest,
  DiagnosticResponse,
  ToolCallTrace,
  StructuredDiagnosis,
} from "../interfaces/assistant.ts";
import type { PendingOperation } from "../interfaces/operation.ts";

export interface AssistantServiceOptions {
  toolService: ToolService;
  operationService?: OperationService;
  llmProvider?: LlmProvider;
  maxIterations?: number;
}

function redactDiagnosis(diagnosis: StructuredDiagnosis): StructuredDiagnosis {
  return {
    facts: (diagnosis.facts || []).map(redactLogMessage),
    hypotheses: (diagnosis.hypotheses || []).map(redactLogMessage),
    evidence: (diagnosis.evidence || []).map(redactLogMessage),
    recommendations: (diagnosis.recommendations || []).map(redactLogMessage),
  };
}

export class AssistantService {
  private toolService: ToolService;
  private operationService?: OperationService;
  private llmProvider?: LlmProvider;
  private maxIterations: number;

  constructor(options: AssistantServiceOptions) {
    this.toolService = options.toolService;
    this.operationService = options.operationService;
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
    let proposedOperation: PendingOperation | undefined;
    let proposalRejectionReason: string | undefined;

    for (let step = 0; step < this.maxIterations; step++) {
      const output = await this.llmProvider.chat({
        query: request.query,
        serviceId: request.serviceId,
        step,
        availableTools,
        toolResults: toolTraces,
      });

      if (output.toolCall) {
        try {
          const result = await this.toolService.execute(
            output.toolCall.tool,
            output.toolCall.parameters
          );
          toolTraces.push({
            tool: output.toolCall.tool,
            parameters: output.toolCall.parameters,
            result,
          });
        } catch (err: any) {
          toolTraces.push({
            tool: output.toolCall.tool,
            parameters: output.toolCall.parameters,
            error: err?.message || "Tool execution failed",
          });
        }
      }

      if (output.proposedAction && this.operationService) {
        const targetServiceId = output.proposedAction.serviceId || request.serviceId;
        if (targetServiceId) {
          const res = await this.operationService.requestOperation({
            serviceId: targetServiceId,
            action: output.proposedAction.action,
            actor: "assistant",
          });
          if ("operation" in res) {
            proposedOperation = res.operation;
          } else {
            proposalRejectionReason = res.error;
          }
        }
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
      diagnosis: redactDiagnosis(finalDiagnosis),
      proposedOperation,
      proposalRejectionReason,
    };
  }
}
