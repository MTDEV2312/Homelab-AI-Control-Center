// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerWebMcpTools } from "../src/services/webmcp.ts";
import type { ToolDefinition } from "../src/interfaces/tool.ts";

describe("registerWebMcpTools", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("registers read-only tools in navigator.modelContext when supported", async () => {
    const mockRegistered: Array<{ name: string; description: string; inputSchema: any; handler: Function }> = [];
    const mockModelContext = {
      registerTool: vi.fn((tool: any) => {
        mockRegistered.push(tool);
      }),
    };

    Object.defineProperty(window.navigator, "modelContext", {
      value: mockModelContext,
      configurable: true,
      writable: true,
    });

    const tools: ToolDefinition[] = [
      {
        name: "list_services",
        description: "List registered services",
        readOnly: true,
        inputSchema: { type: "object", properties: {} },
      },
    ];

    const executeMock = vi.fn().mockResolvedValue({ success: true });

    const result = await registerWebMcpTools({
      tools,
      executor: executeMock,
    });

    expect(result.supported).toBe(true);
    expect(result.registeredTools).toEqual(["list_services"]);
    expect(mockModelContext.registerTool).toHaveBeenCalledTimes(1);

    const toolHandler = mockRegistered[0].handler;
    const invocationResult = await toolHandler({ status: "running" });
    expect(executeMock).toHaveBeenCalledWith("list_services", { status: "running" });
    expect(invocationResult).toEqual({ success: true });
  });

  it("handles missing navigator.modelContext gracefully", async () => {
    Object.defineProperty(window.navigator, "modelContext", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const result = await registerWebMcpTools({
      tools: [],
      executor: vi.fn(),
    });

    expect(result.supported).toBe(false);
    expect(result.registeredTools).toEqual([]);
  });
});
