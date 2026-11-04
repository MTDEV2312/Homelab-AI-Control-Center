import type { ToolDefinition } from "../interfaces/tool.ts";

export interface RegisterWebMcpOptions {
  tools: ToolDefinition[];
  executor?: (toolName: string, parameters: Record<string, any>) => Promise<any>;
}

export interface RegisterWebMcpResult {
  supported: boolean;
  registeredTools: string[];
}

export async function registerWebMcpTools(
  options: RegisterWebMcpOptions
): Promise<RegisterWebMcpResult> {
  const nav = typeof window !== "undefined" ? (window.navigator as any) : undefined;
  if (!nav || !nav.modelContext || typeof nav.modelContext.registerTool !== "function") {
    return {
      supported: false,
      registeredTools: [],
    };
  }

  const defaultExecutor = async (toolName: string, parameters: Record<string, any>) => {
    const res = await fetch("/api/tools/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: toolName, parameters }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Tool execution failed" }));
      throw new Error(err.error || "Tool execution failed");
    }
    const data = await res.json();
    return data.result;
  };

  const executor = options.executor || defaultExecutor;
  const registeredTools: string[] = [];

  for (const tool of options.tools) {
    nav.modelContext.registerTool({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      handler: async (parameters: Record<string, any>) => {
        return executor(tool.name, parameters);
      },
    });
    registeredTools.push(tool.name);
  }

  return {
    supported: true,
    registeredTools,
  };
}
