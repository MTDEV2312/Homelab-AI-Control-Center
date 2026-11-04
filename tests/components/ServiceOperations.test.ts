// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ServiceOperations from "../../src/components/ServiceOperations.vue";
import type { PendingOperation, AuditEntry } from "../../src/interfaces/operation.ts";

describe("ServiceOperations component", () => {
  it("renders action buttons and prompts explicit confirmation displaying risk level badge before confirming", async () => {
    const pendingOp: PendingOperation = {
      id: "op-123",
      serviceId: "srv-1",
      action: "stop",
      riskLevel: "L3",
      status: "pending",
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      confirmationToken: "token-abc-123",
      createdAt: new Date().toISOString(),
    };

    const auditTrail: AuditEntry[] = [
      {
        id: "aud-1",
        actor: "admin",
        action: "restart",
        riskLevel: "L2",
        serviceId: "srv-1",
        outcome: "success",
        timestamp: "2026-11-04T12:00:00Z",
      },
    ];

    const wrapper = mount(ServiceOperations, {
      props: {
        serviceId: "srv-1",
        serviceName: "vaultwarden",
        status: "running",
        allowedActions: ["start", "stop", "restart"],
        pendingOperation: null,
        auditLog: auditTrail,
      },
    });

    // 1. Action buttons exist
    const stopBtn = wrapper.find('button[data-action="stop"]');
    expect(stopBtn.exists()).toBe(true);

    await stopBtn.trigger("click");
    expect(wrapper.emitted("requestAction")).toBeTruthy();
    expect(wrapper.emitted("requestAction")?.[0]).toEqual(["stop", "srv-1"]);

    // 2. Set pending operation prop to display confirmation UI
    await wrapper.setProps({ pendingOperation: pendingOp });

    const confirmationBox = wrapper.find(".confirmation-dialog");
    expect(confirmationBox.exists()).toBe(true);

    const riskBadge = confirmationBox.find(".risk-badge");
    expect(riskBadge.exists()).toBe(true);
    expect(riskBadge.text()).toContain("L3");
    expect(confirmationBox.text()).toContain("stop");

    // 3. Confirm trigger
    const confirmBtn = confirmationBox.find(".btn-confirm");
    expect(confirmBtn.exists()).toBe(true);
    await confirmBtn.trigger("click");

    expect(wrapper.emitted("confirmOperation")).toBeTruthy();
    expect(wrapper.emitted("confirmOperation")?.[0]).toEqual(["op-123", "token-abc-123"]);

    // 4. Audit trail renders previous events
    const auditSection = wrapper.find(".audit-trail");
    expect(auditSection.exists()).toBe(true);
    expect(auditSection.text()).toContain("restart");
    expect(auditSection.text()).toContain("success");
    expect(auditSection.text()).toContain("L2");
  });
});
