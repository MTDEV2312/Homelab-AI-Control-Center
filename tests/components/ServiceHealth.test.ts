// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ServiceHealth from "../../src/components/ServiceHealth.vue";

describe("ServiceHealth component", () => {
  it("renders latest latency badge, consecutive failures, and triggers on-demand check", async () => {
    const wrapper = mount(ServiceHealth, {
      props: {
        serviceId: "srv-123",
        healthCheck: {
          id: "chk-1",
          serviceId: "srv-123",
          status: "unhealthy",
          latencyMs: 85,
          checkedAt: "2026-11-03T21:00:00.000Z",
          errorCode: "TIMEOUT",
        },
        consecutiveFailures: 3,
        history: [
          {
            id: "chk-0",
            serviceId: "srv-123",
            status: "healthy",
            latencyMs: 20,
            checkedAt: "2026-11-03T20:59:00.000Z",
          },
          {
            id: "chk-1",
            serviceId: "srv-123",
            status: "unhealthy",
            latencyMs: 85,
            checkedAt: "2026-11-03T21:00:00.000Z",
            errorCode: "TIMEOUT",
          },
        ],
      },
    });

    expect(wrapper.text()).toContain("85ms");
    expect(wrapper.text()).toContain("unhealthy");
    expect(wrapper.text()).toContain("3 consecutive failures");
    expect(wrapper.findAll(".health-history-item")).toHaveLength(2);

    const runBtn = wrapper.find(".run-check-btn");
    expect(runBtn.exists()).toBe(true);

    await runBtn.trigger("click");

    expect(wrapper.emitted("runCheck")).toBeTruthy();
    expect(wrapper.emitted("runCheck")?.[0]).toEqual(["srv-123"]);
  });
});
