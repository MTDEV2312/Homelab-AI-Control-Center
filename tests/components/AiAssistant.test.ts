// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AiAssistant from "../../src/components/AiAssistant.vue";
import type { DiagnosticResponse } from "../../src/interfaces/assistant.ts";

describe("AiAssistant component", () => {
  it("renders input form, emits ask event, and displays tool traces and separated diagnostic sections", async () => {
    const sampleResponse: DiagnosticResponse = {
      query: "Why did authentication fail?",
      toolTraces: [
        {
          tool: "search_logs",
          parameters: { service_id: "srv-1", query: "auth" },
          result: {
            entries: [{ timestamp: "2026-11-04T12:00:00Z", message: "Failed login with password=[REDACTED]", level: "error" }],
          },
        },
      ],
      diagnosis: {
        facts: ["Auth error logged in container auth-svc"],
        hypotheses: ["User supplied an invalid credential"],
        evidence: ["Log shows failed login attempt at 2026-11-04T12:00:00Z"],
        recommendations: ["Check client credentials or reset password"],
      },
    };

    const wrapper = mount(AiAssistant, {
      props: {
        serviceId: "srv-1",
        serviceName: "auth-svc",
        diagnosticResponse: sampleResponse,
      },
    });

    // 1. Check form rendering & emit
    const input = wrapper.find('input[name="query"]');
    expect(input.exists()).toBe(true);
    await input.setValue("Investigate recent crashes");
    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.emitted("ask")).toBeTruthy();
    expect(wrapper.emitted("ask")?.[0]).toEqual(["Investigate recent crashes", "srv-1"]);

    // 2. Check tool execution trace rendering (direct tool output)
    const trace = wrapper.find(".tool-trace");
    expect(trace.exists()).toBe(true);
    expect(trace.text()).toContain("search_logs");
    expect(trace.text()).toContain("Failed login with password=[REDACTED]");

    // 3. Check separated findings sections
    const facts = wrapper.find(".diagnosis-facts");
    expect(facts.exists()).toBe(true);
    expect(facts.text()).toContain("Auth error logged in container auth-svc");

    const hypotheses = wrapper.find(".diagnosis-hypotheses");
    expect(hypotheses.exists()).toBe(true);
    expect(hypotheses.text()).toContain("User supplied an invalid credential");

    const evidence = wrapper.find(".diagnosis-evidence");
    expect(evidence.exists()).toBe(true);
    expect(evidence.text()).toContain("Log shows failed login attempt");

    const recommendations = wrapper.find(".diagnosis-recommendations");
    expect(recommendations.exists()).toBe(true);
    expect(recommendations.text()).toContain("Check client credentials or reset password");
  });
});
