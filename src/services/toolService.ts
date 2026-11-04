import type { ToolDefinition } from "../interfaces/tool.ts";
import type { ServiceManager } from "./serviceManager.ts";

export const READONLY_TOOLS: ToolDefinition[] = [
  {
    name: "list_services",
    description: "List registered services and summary with optional status filter",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter services by status",
          enum: ["running", "stopped", "unhealthy", "unknown"],
        },
        limit: {
          type: "number",
          description: "Maximum number of services to return",
        },
      },
    },
  },
  {
    name: "get_service_status",
    description: "Get service details, live status, and container resource metrics by service ID",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        service_id: {
          type: "string",
          description: "ID of the registered service",
        },
      },
      required: ["service_id"],
    },
  },
  {
    name: "search_logs",
    description: "Search service container logs by text query, level, and time range with sensitive data redacted",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        service_id: {
          type: "string",
          description: "ID of the service to inspect logs for",
        },
        query: {
          type: "string",
          description: "Search text to filter log messages",
        },
        level: {
          type: "string",
          description: "Log level severity filter",
          enum: ["info", "warn", "error"],
        },
        since: {
          type: "string",
          description: "ISO timestamp filter for starting time",
        },
        limit: {
          type: "number",
          description: "Maximum log entries to return",
        },
      },
      required: ["service_id"],
    },
  },
];

export class ToolService {
  constructor(private serviceManager: ServiceManager) {}

  getTools(): ToolDefinition[] {
    return READONLY_TOOLS;
  }

  async execute(toolName: string, parameters: Record<string, any> = {}): Promise<any> {
    if (toolName === "list_services") {
      const data = await this.serviceManager.list();
      let services = data.services;
      if (parameters.status) {
        services = services.filter((s) => s.status === parameters.status);
      }
      if (typeof parameters.limit === "number") {
        services = services.slice(0, parameters.limit);
      }
      return {
        summary: data.summary,
        services,
      };
    }

    if (toolName === "get_service_status") {
      if (!parameters.service_id) {
        throw new Error("Missing required parameter: service_id");
      }
      const service = await this.serviceManager.getById(parameters.service_id);
      if (!service) {
        throw new Error(`Service not found: ${parameters.service_id}`);
      }
      return service;
    }

    if (toolName === "search_logs") {
      if (!parameters.service_id) {
        throw new Error("Missing required parameter: service_id");
      }
      const logsResult = await this.serviceManager.getLogs(parameters.service_id, {
        query: parameters.query,
        level: parameters.level,
        since: parameters.since,
        limit: parameters.limit,
      });
      if (!logsResult) {
        throw new Error(`Service not found: ${parameters.service_id}`);
      }
      return logsResult;
    }

    throw new Error(`Unknown tool: ${toolName}`);
  }
}
