// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import N8nWorkflows from "../../src/components/N8nWorkflows.vue";
import type { N8nWorkflow, N8nExecution } from "../../src/interfaces/n8n.ts";

describe("N8nWorkflows component", () => {
  it("renders workflows with active/inactive badges, failed executions list, and emits filterFailedExecutions event", async () => {
    const workflows: N8nWorkflow[] = [
      {
        id: "wf-1",
        name: "Nightly Database Backup",
        active: true,
        lastExecutionStatus: "success",
      },
      {
        id: "wf-2",
        name: "Alert Webhook Relay",
        active: false,
        lastExecutionStatus: "error",
      },
    ];

    const failedExecutions: N8nExecution[] = [
      {
        id: "ex-2",
        workflowId: "wf-2",
        workflowName: "Alert Webhook Relay",
        status: "error",
        startedAt: "2026-11-16T12:00:00Z",
        stoppedAt: "2026-11-16T12:00:03Z",
        errorMessage: "Webhook auth rejected: Bearer [REDACTED]",
      },
    ];

    const wrapper = mount(N8nWorkflows, {
      props: {
        summary: { total: 2, active: 1, failedExecutions: 1 },
        workflows,
        failedExecutions,
      },
    });

    // 1. Renders summary and workflow items with active/inactive badges
    expect(wrapper.text()).toContain("Active: 1");
    expect(wrapper.text()).toContain("Failed Executions: 1");

    const wf1 = wrapper.find('[data-workflow-id="wf-1"]');
    expect(wf1.exists()).toBe(true);
    expect(wf1.text()).toContain("Nightly Database Backup");
    expect(wf1.find(".workflow-state.active").exists()).toBe(true);

    const wf2 = wrapper.find('[data-workflow-id="wf-2"]');
    expect(wf2.exists()).toBe(true);
    expect(wf2.text()).toContain("Alert Webhook Relay");
    expect(wf2.find(".workflow-state.inactive").exists()).toBe(true);

    // 2. Renders failed executions with sanitized error message
    const failedItem = wrapper.find('[data-execution-id="ex-2"]');
    expect(failedItem.exists()).toBe(true);
    expect(failedItem.text()).toContain("Alert Webhook Relay");
    expect(failedItem.text()).toContain("Webhook auth rejected: Bearer [REDACTED]");

    // 3. Emits filterFailedExecutions when workflow filter select changes
    const filterSelect = wrapper.find('select[data-field="workflowFilter"]');
    expect(filterSelect.exists()).toBe(true);
    await filterSelect.setValue("wf-2");

    expect(wrapper.emitted("filterFailedExecutions")).toBeTruthy();
    expect(wrapper.emitted("filterFailedExecutions")?.[0]).toEqual([{ workflowId: "wf-2" }]);
  });
});
