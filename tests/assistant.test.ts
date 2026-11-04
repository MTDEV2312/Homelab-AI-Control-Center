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
});
