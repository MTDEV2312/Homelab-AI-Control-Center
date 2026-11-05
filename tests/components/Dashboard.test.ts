// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Dashboard from "../../src/components/Dashboard.vue";

describe("Dashboard component", () => {
  it("renders summary cards, service list items with status badges, and registration form", async () => {
    const wrapper = mount(Dashboard, {
      props: {
        summary: { total: 2, online: 1, unhealthy: 1 },
        integrationStatus: { docker: "available" },
        services: [
          {
            id: "1",
            name: "jellyfin",
            externalId: "jellyfin-c",
            integration: "docker",
            status: "running",
            lastCheckedAt: "2026-10-31T21:00:00.000Z",
          },
          {
            id: "2",
            name: "n8n",
            externalId: "n8n-c",
            integration: "docker",
            status: "unhealthy",
            lastCheckedAt: "2026-10-31T21:00:00.000Z",
          },
        ],
      },
    });

    expect(wrapper.text()).toContain("Total Services: 2");
    expect(wrapper.text()).toContain("Online: 1");
    expect(wrapper.text()).toContain("Unhealthy: 1");

    expect(wrapper.text()).toContain("jellyfin");
    expect(wrapper.text()).toContain("running");
    expect(wrapper.text()).toContain("docker");

    expect(wrapper.text()).toContain("n8n");
    expect(wrapper.text()).toContain("unhealthy");

    const nameInput = wrapper.find('input[name="name"]');
    const externalIdInput = wrapper.find('input[name="externalId"]');
    expect(nameInput.exists()).toBe(true);
    expect(externalIdInput.exists()).toBe(true);

    await nameInput.setValue("traefik");
    await externalIdInput.setValue("traefik-c");
    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.emitted("registerService")).toBeTruthy();
    expect(wrapper.emitted("registerService")?.[0]).toEqual([
      { name: "traefik", externalId: "traefik-c", integration: "docker" },
    ]);
  });

  it("opens service detail panel with live metrics when clicking a service item", async () => {
    const wrapper = mount(Dashboard, {
      props: {
        summary: { total: 1, online: 1, unhealthy: 0 },
        integrationStatus: { docker: "available" },
        services: [
          {
            id: "1",
            name: "jellyfin",
            externalId: "jellyfin-c",
            integration: "docker",
            status: "running",
            metrics: {
              available: true,
              cpuPercent: 12.5,
              memoryUsedBytes: 536870912,
              memoryLimitBytes: 2147483648,
              uptimeSeconds: 86400,
            },
          },
        ],
      },
    });

    expect(wrapper.find(".service-detail-panel").exists()).toBe(false);

    await wrapper.find(".service-item").trigger("click");

    const detailPanel = wrapper.find(".service-detail-panel");
    expect(detailPanel.exists()).toBe(true);
    expect(detailPanel.text()).toContain("jellyfin");
    expect(detailPanel.text()).toContain("12.5%");
    expect(detailPanel.text()).toContain("CPU Usage");
    expect(detailPanel.text()).toContain("Memory Usage");

    await detailPanel.find(".close-btn").trigger("click");
    expect(wrapper.find(".service-detail-panel").exists()).toBe(false);
  });

  it("renders WebMCP status badge and tolerates missing browser support", async () => {
    const wrapperSupported = mount(Dashboard, {
      props: {
        webmcpStatus: { supported: true, registeredCount: 3 },
      },
    });

    expect(wrapperSupported.find(".webmcp-status").exists()).toBe(true);
    expect(wrapperSupported.find(".webmcp-status").text()).toContain("WebMCP Active (3 tools)");

    const wrapperUnsupported = mount(Dashboard, {
      props: {
        webmcpStatus: { supported: false, registeredCount: 0 },
      },
    });

    expect(wrapperUnsupported.find(".webmcp-status").exists()).toBe(true);
    expect(wrapperUnsupported.find(".webmcp-status").text()).toContain("WebMCP Unavailable");
  });

  it("embeds AiAssistant in detail drawer and forwards ask event", async () => {
    const wrapper = mount(Dashboard, {
      props: {
        services: [
          {
            id: "srv-1",
            name: "vaultwarden",
            externalId: "vw-ctr",
            integration: "docker",
            status: "running",
          },
        ],
      },
    });

    await wrapper.find(".service-item").trigger("click");
    const assistant = wrapper.findComponent({ name: "AiAssistant" });
    expect(assistant.exists()).toBe(true);

    await assistant.vm.$emit("ask", "Why is vaultwarden locked?", "srv-1");
    expect(wrapper.emitted("askAiAssistant")).toBeTruthy();
    expect(wrapper.emitted("askAiAssistant")?.[0]).toEqual(["Why is vaultwarden locked?", "srv-1"]);
  });

  it("embeds ServiceOperations and renders audit trail in service drawer", async () => {
    const wrapper = mount(Dashboard, {
      props: {
        services: [
          {
            id: "srv-1",
            name: "vaultwarden",
            externalId: "vw-ctr",
            integration: "docker",
            status: "running",
          },
        ],
        auditLog: [
          {
            id: "aud-1",
            actor: "admin",
            action: "restart",
            riskLevel: "L2",
            serviceId: "srv-1",
            outcome: "success",
            timestamp: "2026-11-04T12:00:00Z",
          },
        ],
      },
    });

    await wrapper.find(".service-item").trigger("click");
    const operationsComp = wrapper.findComponent({ name: "ServiceOperations" });
    expect(operationsComp.exists()).toBe(true);

    await operationsComp.vm.$emit("requestAction", "restart", "srv-1");
    expect(wrapper.emitted("requestAction")).toBeTruthy();
    expect(wrapper.emitted("requestAction")?.[0]).toEqual(["restart", "srv-1"]);

    await operationsComp.vm.$emit("confirmOperation", "op-1", "token-1");
    expect(wrapper.emitted("confirmOperation")).toBeTruthy();
    expect(wrapper.emitted("confirmOperation")?.[0]).toEqual(["op-1", "token-1"]);
  });

  it("forwards assistant proposed operation confirmation into shared confirmOperation event", async () => {
    const wrapper = mount(Dashboard, {
      props: {
        services: [
          {
            id: "srv-1",
            name: "vaultwarden",
            externalId: "vw-ctr",
            integration: "docker",
            status: "running",
          },
        ],
        assistantResponse: {
          query: "Fix memory leak",
          toolTraces: [],
          diagnosis: {
            facts: ["Memory leak"],
            hypotheses: [],
            evidence: [],
            recommendations: ["Restart container"],
          },
          proposedOperation: {
            id: "op-ai-456",
            serviceId: "srv-1",
            action: "restart",
            riskLevel: "L2",
            status: "pending",
            expiresAt: new Date(Date.now() + 300000).toISOString(),
            confirmationToken: "token-ai-456",
            createdAt: new Date().toISOString(),
          },
        },
      },
    });

    await wrapper.find(".service-item").trigger("click");
    const assistant = wrapper.findComponent({ name: "AiAssistant" });
    expect(assistant.exists()).toBe(true);

    await assistant.vm.$emit("confirmOperation", "op-ai-456", "token-ai-456");
    expect(wrapper.emitted("confirmOperation")).toBeTruthy();
    expect(wrapper.emitted("confirmOperation")?.[0]).toEqual(["op-ai-456", "token-ai-456"]);
  });
});
