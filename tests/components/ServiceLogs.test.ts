// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ServiceLogs from "../../src/components/ServiceLogs.vue";

describe("ServiceLogs component", () => {
  it("renders log entries and emits filter changes when controls are modified", async () => {
    const logs = [
      {
        timestamp: "2026-10-31T22:00:00.000Z",
        level: "info" as const,
        message: "Auth header received: Bearer [REDACTED]",
      },
      {
        timestamp: "2026-10-31T22:01:00.000Z",
        level: "error" as const,
        message: "Database connection failed",
      },
    ];

    const wrapper = mount(ServiceLogs, {
      props: { logs },
    });

    expect(wrapper.text()).toContain("Auth header received: Bearer [REDACTED]");
    expect(wrapper.text()).toContain("Database connection failed");
    expect(wrapper.findAll(".log-entry")).toHaveLength(2);

    const queryInput = wrapper.find('input[name="logQuery"]');
    const levelSelect = wrapper.find('select[name="logLevel"]');
    expect(queryInput.exists()).toBe(true);
    expect(levelSelect.exists()).toBe(true);

    await queryInput.setValue("Database");
    await levelSelect.setValue("error");

    expect(wrapper.emitted("filterChange")).toBeTruthy();
    const lastEmission = wrapper.emitted("filterChange")?.slice(-1)[0][0];
    expect(lastEmission).toMatchObject({
      query: "Database",
      level: "error",
    });
  });
});
