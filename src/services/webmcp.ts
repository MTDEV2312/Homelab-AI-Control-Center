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
  const context =
    (typeof document !== "undefined" && (document as any).modelContext) ||
    (typeof window !== "undefined" && (window as any).modelContext) ||
    (typeof navigator !== "undefined" && (navigator as any).modelContext);

  if (typeof window !== "undefined") {
    console.debug("[WebMCP] Diagnostic check:", {
      isSecureContext: window.isSecureContext,
      hasNavModelContext: "modelContext" in navigator,
      hasDocModelContext: "modelContext" in document,
      contextFound: Boolean(context),
    });
  }

  if (!context || typeof context.registerTool !== "function") {
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
    const runTool = async (parameters: Record<string, any>) => {
      return executor(tool.name, parameters);
    };

    try {
      context.registerTool({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: runTool,
        handler: runTool,
      });
      registeredTools.push(tool.name);
    } catch (err) {
      console.error(`[WebMCP] Failed to register tool "${tool.name}":`, err);
    }
  }

  return {
    supported: true,
    registeredTools,
  };
}
