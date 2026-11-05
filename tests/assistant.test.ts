import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.ts";
import type { LlmProvider } from "../src/interfaces/assistant.ts";

describe("POST /api/assistant/diagnose", () => {
  it("orchestrates read-only tools and returns structured diagnosis with facts, hypotheses, evidence, and recommendations", async () => {
    let targetServiceId = "";

    const mockLlm: LlmProvider = {
      chat: async ({ step, toolResults }) => {
        if (step === 0) {
          return {
            toolCall: {
              tool: "get_service_status",
              parameters: { service_id: targetServiceId },
            },
          };
        }
        return {
          diagnosis: {
            facts: ["Container jellyfin is running with high CPU usage"],
            hypotheses: ["Media transcoding process is saturating CPU"],
            evidence: ["CPU usage reported at 94.5%"],
            recommendations: ["Check hardware acceleration or throttle concurrent streams"],
          },
        };
      },
    };

    const mockDocker = {
      getContainerStatus: async () => "running" as const,
      getContainerMetrics: async () => ({
        available: true,
        cpuPercent: 94.5,
        memoryUsedBytes: 1073741824,
        memoryLimitBytes: 4294967296,
        uptimeSeconds: 7200,
      }),
    };

    const app = buildApp({ dockerClient: mockDocker, llmProvider: mockLlm });

    const regRes = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "jellyfin", externalId: "jellyfin-ctr", integration: "docker" },
    });
    targetServiceId = regRes.json().id;

    const response = await app.inject({
      method: "POST",
      url: "/api/assistant/diagnose",
      payload: {
        query: "Why is jellyfin running slow?",
        serviceId: targetServiceId,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.query).toBe("Why is jellyfin running slow?");
    expect(body.toolTraces).toHaveLength(1);
    expect(body.toolTraces[0]).toMatchObject({
      tool: "get_service_status",
      parameters: { service_id: targetServiceId },
      result: {
        id: targetServiceId,
        status: "running",
        metrics: {
          cpuPercent: 94.5,
        },
      },
    });

    expect(body.diagnosis).toBeDefined();
    expect(body.diagnosis.facts).toContain("Container jellyfin is running with high CPU usage");
    expect(body.diagnosis.hypotheses).toContain("Media transcoding process is saturating CPU");
    expect(body.diagnosis.evidence).toContain("CPU usage reported at 94.5%");
    expect(body.diagnosis.recommendations).toContain("Check hardware acceleration or throttle concurrent streams");
  });

  it("preserves log redaction in tool trace and generated findings", async () => {
    let targetServiceId = "";

    const mockLlm: LlmProvider = {
      chat: async ({ step }) => {
        if (step === 0) {
          return {
            toolCall: {
              tool: "search_logs",
              parameters: { service_id: targetServiceId, query: "secret" },
            },
          };
        }
        return {
          diagnosis: {
            facts: ["Found auth error with token=raw_secret_leak_456 in log"],
            hypotheses: ["Service rejected authorization token"],
            evidence: ["Log entry contains password=mypassword123 in body"],
            recommendations: ["Rotate compromised credentials immediately"],
          },
        };
      },
    };

    const mockDocker = {
      getContainerStatus: async () => "running" as const,
      getContainerLogs: async () => [
        {
          timestamp: "2026-11-04T12:00:00Z",
          message: "Failed login attempt with password=mypassword123 and token=raw_secret_leak_456",
          level: "error" as const,
        },
      ],
    };

    const app = buildApp({ dockerClient: mockDocker, llmProvider: mockLlm });

    const regRes = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "auth-svc", externalId: "auth-ctr", integration: "docker" },
    });
    targetServiceId = regRes.json().id;

    const response = await app.inject({
      method: "POST",
      url: "/api/assistant/diagnose",
      payload: {
        query: "Check for auth errors in auth-svc",
        serviceId: targetServiceId,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    // Verify tool trace redaction
    const logEntry = body.toolTraces[0].result.entries[0];
    expect(logEntry.message).toContain("password=[REDACTED]");
    expect(logEntry.message).toContain("token=[REDACTED]");
    expect(logEntry.message).not.toContain("mypassword123");
    expect(logEntry.message).not.toContain("raw_secret_leak_456");

    // Verify findings redaction
    expect(body.diagnosis.facts[0]).toContain("token=[REDACTED]");
    expect(body.diagnosis.facts[0]).not.toContain("raw_secret_leak_456");
    expect(body.diagnosis.evidence[0]).toContain("password=[REDACTED]");
    expect(body.diagnosis.evidence[0]).not.toContain("mypassword123");
  });

  it("returns 503 error when LLM provider is unavailable or fails", async () => {
    // Subcase 1: Provider not configured
    const appWithoutLlm = buildApp();
    const resNoLlm = await appWithoutLlm.inject({
      method: "POST",
      url: "/api/assistant/diagnose",
      payload: { query: "What is wrong with jellyfin?" },
    });
    expect(resNoLlm.statusCode).toBe(503);
    expect(resNoLlm.json().error).toContain("unavailable");

    // Subcase 2: Provider fails with network / connection error
    const failingLlm: LlmProvider = {
      chat: async () => {
        throw new Error("Connection refused to Ollama service on port 11434");
      },
    };
    const appWithFailingLlm = buildApp({ llmProvider: failingLlm });
    const resFailedLlm = await appWithFailingLlm.inject({
      method: "POST",
      url: "/api/assistant/diagnose",
      payload: { query: "Why is the container stopped?" },
    });
    expect(resFailedLlm.statusCode).toBe(503);
    expect(resFailedLlm.json().error).toContain("Connection refused to Ollama");
  });
});

describe("AssistantService unit", () => {
  it("bounds tool call iterations to prevent infinite loops", async () => {
    let callCount = 0;
    const infiniteLlm: LlmProvider = {
      chat: async () => {
        callCount++;
        return {
          toolCall: {
            tool: "list_services",
            parameters: {},
          },
        };
      },
    };

    const mockServiceManager = {
      list: async () => ({
        summary: { total: 0, online: 0, unhealthy: 0 },
        integrationStatus: { docker: "available" as const },
        services: [],
      }),
    } as any;

    const { ToolService } = await import("../src/services/toolService.ts");
    const { AssistantService } = await import("../src/services/assistantService.ts");

    const toolService = new ToolService(mockServiceManager);
    const service = new AssistantService({
      toolService,
      llmProvider: infiniteLlm,
      maxIterations: 2,
    });

    const result = await service.diagnose({ query: "Trigger endless tool loop" });

    expect(callCount).toBe(2);
    expect(result.toolTraces).toHaveLength(2);
    expect(result.diagnosis.facts[0]).toContain("maximum investigation iterations");
    expect(result.diagnosis.recommendations).toHaveLength(1);
  });

  it("captures tool execution errors in trace without aborting diagnosis", async () => {
    const errorToolLlm: LlmProvider = {
      chat: async ({ step }) => {
        if (step === 0) {
          return {
            toolCall: {
              tool: "non_existent_tool",
              parameters: {},
            },
          };
        }
        return {
          diagnosis: {
            facts: ["Encountered unavailable tool during investigation"],
            hypotheses: [],
            evidence: [],
            recommendations: ["Check available tool catalog"],
          },
        };
      },
    };

    const mockServiceManager = {
      list: async () => ({
        summary: { total: 0, online: 0, unhealthy: 0 },
        integrationStatus: { docker: "available" as const },
        services: [],
      }),
    } as any;

    const { ToolService } = await import("../src/services/toolService.ts");
    const { AssistantService } = await import("../src/services/assistantService.ts");

    const toolService = new ToolService(mockServiceManager);
    const service = new AssistantService({
      toolService,
      llmProvider: errorToolLlm,
      maxIterations: 3,
    });

    const result = await service.diagnose({ query: "Test tool error capture" });

    expect(result.toolTraces).toHaveLength(1);
    expect(result.toolTraces[0].tool).toBe("non_existent_tool");
    expect(result.toolTraces[0].error).toContain("Unknown tool");
    expect(result.diagnosis.facts[0]).toContain("Encountered unavailable tool");
  });

  it("registers proposed recovery action as a pending operation without executing it", async () => {
    let executedContainerAction = false;
    let targetServiceId = "";

    const mockLlm: LlmProvider = {
      chat: async () => ({
        diagnosis: {
          facts: ["Jellyfin process is deadlocked"],
          hypotheses: ["Memory leak in transcoder"],
          evidence: ["Service unresponsive for 10 minutes"],
          recommendations: ["Restart the service to recover memory"],
        },
        proposedAction: {
          action: "restart",
        },
      }),
    };

    const mockDocker = {
      getContainerStatus: async () => "unhealthy" as const,
      executeContainerAction: async () => {
        executedContainerAction = true;
      },
    };

    const app = buildApp({ dockerClient: mockDocker, llmProvider: mockLlm });

    const regRes = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "jellyfin", externalId: "jellyfin-ctr", integration: "docker" },
    });
    targetServiceId = regRes.json().id;

    const res = await app.inject({
      method: "POST",
      url: "/api/assistant/diagnose",
      payload: {
        query: "Diagnose and fix jellyfin",
        serviceId: targetServiceId,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.proposedOperation).toBeDefined();
    expect(body.proposedOperation).toMatchObject({
      serviceId: targetServiceId,
      action: "restart",
      riskLevel: "L2",
      status: "pending",
    });
    expect(body.proposedOperation.confirmationToken).toBeDefined();
    expect(executedContainerAction).toBe(false);
  });

  it("blocks assistant write tool execution attempt during tool-calling loop and logs audit rejection", async () => {
    let targetServiceId = "";

    const mockLlm: LlmProvider = {
      chat: async ({ step }) => {
        if (step === 0) {
          return {
            toolCall: {
              tool: "restart_service",
              parameters: { service_id: targetServiceId },
            },
          };
        }
        return {
          diagnosis: {
            facts: ["Attempted autonomous restart"],
            hypotheses: [],
            evidence: [],
            recommendations: ["Require human confirmation"],
          },
        };
      },
    };

    const mockDocker = {
      getContainerStatus: async () => "running" as const,
      executeContainerAction: async () => {},
    };

    const app = buildApp({ dockerClient: mockDocker, llmProvider: mockLlm });

    const regRes = await app.inject({
      method: "POST",
      url: "/api/services",
      payload: { name: "pihole", externalId: "pihole-ctr", integration: "docker" },
    });
    targetServiceId = regRes.json().id;

    const res = await app.inject({
      method: "POST",
      url: "/api/assistant/diagnose",
      payload: {
        query: "Restart pihole immediately",
        serviceId: targetServiceId,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.toolTraces).toHaveLength(1);
    expect(body.toolTraces[0].tool).toBe("restart_service");
    expect(body.toolTraces[0].error).toContain("Write operations cannot be executed directly");

    const auditRes = await app.inject({
      method: "GET",
      url: `/api/audit?serviceId=${targetServiceId}`,
    });
    expect(auditRes.statusCode).toBe(200);
    const auditEntries = auditRes.json();
    const rejectedEntry = auditEntries.find((e: any) => e.actor === "assistant" && e.outcome === "rejected");
    expect(rejectedEntry).toBeDefined();
    expect(rejectedEntry.details).toContain("Autonomous write tool execution blocked");
  });
});
