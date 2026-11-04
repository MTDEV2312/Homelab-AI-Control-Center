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

  it("registers read-only tools in document.modelContext when supported", async () => {
    const mockRegistered: Array<{ name: string; description: string; inputSchema: any; execute: Function }> = [];
    const mockModelContext = {
      registerTool: vi.fn((tool: any) => {
        mockRegistered.push(tool);
      }),
    };

    Object.defineProperty(window.document, "modelContext", {
      value: mockModelContext,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window.navigator, "modelContext", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const tools: ToolDefinition[] = [
      {
        name: "search_logs",
        description: "Search logs",
        readOnly: true,
        inputSchema: { type: "object", properties: {} },
      },
    ];

    const executeMock = vi.fn().mockResolvedValue({ logs: [] });

    const result = await registerWebMcpTools({
      tools,
      executor: executeMock,
    });

    expect(result.supported).toBe(true);
    expect(result.registeredTools).toEqual(["search_logs"]);
    expect(mockModelContext.registerTool).toHaveBeenCalledTimes(1);

    const toolExec = mockRegistered[0].execute;
    const invocationResult = await toolExec({ service_id: "1" });
    expect(executeMock).toHaveBeenCalledWith("search_logs", { service_id: "1" });
    expect(invocationResult).toEqual({ logs: [] });
  });

  it("handles missing modelContext gracefully", async () => {
    Object.defineProperty(window.navigator, "modelContext", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window.document, "modelContext", {
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
