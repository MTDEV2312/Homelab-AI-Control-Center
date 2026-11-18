import type { ToolDefinition } from "../interfaces/tool.ts";
import type { JsonRpcRequest, JsonRpcResponse } from "../interfaces/mcp.ts";
import type { ToolService } from "./toolService.ts";
import type { IncidentService } from "./incidentService.ts";
import type { OperationService } from "./operationService.ts";

const MCP_EXTRA_TOOLS: ToolDefinition[] = [
  {
    name: "list_incidents",
    description: "List recorded service incidents with optional service_id and status filters",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        service_id: {
          type: "string",
          description: "Filter incidents by service ID",
        },
        status: {
          type: "string",
          description: "Filter incidents by lifecycle status",
          enum: ["open", "investigating", "mitigated", "resolved"],
        },
      },
    },
  },
  {
    name: "request_service_operation",
    description:
      "Request a controlled container operation (start, stop, restart). Creates a pending operation (L2/L3) requiring human confirmation.",
    readOnly: false,
    inputSchema: {
      type: "object",
      properties: {
        service_id: {
          type: "string",
          description: "ID of the target service",
        },
        action: {
          type: "string",
          description: "Operation action to request",
          enum: ["start", "stop", "restart"],
        },
      },
      required: ["service_id", "action"],
    },
  },
];

export class McpService {
  private toolService: ToolService;
  private incidentService: IncidentService;
  private operationService: OperationService;

  constructor(options: {
    toolService: ToolService;
    incidentService: IncidentService;
    operationService: OperationService;
  }) {
    this.toolService = options.toolService;
    this.incidentService = options.incidentService;
    this.operationService = options.operationService;
  }

  getMcpTools(): ToolDefinition[] {
    return [...this.toolService.getTools(), ...MCP_EXTRA_TOOLS];
  }

  async handleRpc(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const id = request.id ?? null;

    if (request.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: {
            name: "homelab-ai-control-center-mcp",
            version: "0.1.0",
          },
          capabilities: {
            tools: {},
          },
        },
      };
    }

    if (request.method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: this.getMcpTools(),
        },
      };
    }

    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32601,
        message: `Method not found: ${request.method}`,
      },
    };
  }
}
