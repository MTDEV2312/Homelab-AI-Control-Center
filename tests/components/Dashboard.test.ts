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

  it("embeds ServiceIncidents in detail drawer and forwards incident create and update events", async () => {
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
        incidents: [
          {
            id: "inc-1",
            serviceId: "srv-1",
            title: "Database locked",
            severity: "high",
            status: "open",
            startedAt: "2026-11-04T12:00:00Z",
            hypotheses: ["Stuck backup process"],
            evidence: ["500 internal server error"],
            actions: [],
          },
        ],
      },
    });

    await wrapper.find(".service-item").trigger("click");
    const incidentsComp = wrapper.findComponent({ name: "ServiceIncidents" });
    expect(incidentsComp.exists()).toBe(true);

    // Forward createIncident
    const createPayload = {
      serviceId: "srv-1",
      title: "High memory alert",
      severity: "medium" as const,
    };
    await incidentsComp.vm.$emit("createIncident", createPayload);
    expect(wrapper.emitted("createIncident")).toBeTruthy();
    expect(wrapper.emitted("createIncident")?.[0]).toEqual([createPayload]);

    // Forward updateIncident
    const updatePayload = {
      status: "resolved" as const,
      confirmedCause: "Resolved memory spike",
    };
    await incidentsComp.vm.$emit("updateIncident", "inc-1", updatePayload);
    expect(wrapper.emitted("updateIncident")).toBeTruthy();
    expect(wrapper.emitted("updateIncident")?.[0]).toEqual(["inc-1", updatePayload]);
  });

  it("renders Uptime Kuma unavailable banner, displays linked monitor badge on services, and embeds UptimeKumaMonitors in detail drawer", async () => {
    const wrapper = mount(Dashboard, {
      props: {
        integrationStatus: { docker: "available", uptimeKuma: "unavailable" },
        services: [
          {
            id: "srv-1",
            name: "vaultwarden",
            externalId: "vw-ctr",
            integration: "docker",
            status: "running",
            uptimeKumaMonitor: {
              id: "mon-vw",
              name: "Vaultwarden Public Endpoint",
              status: "down",
              uptimePercent: 94.2,
              latencyMs: 0,
              serviceId: "srv-1",
              heartbeats: [
                { status: "down", timestamp: "2026-11-15T20:01:00Z", latencyMs: 0, message: "502 Bad Gateway" },
              ],
            },
          },
        ],
        uptimeKumaMonitors: [
          {
            id: "mon-vw",
            name: "Vaultwarden Public Endpoint",
            status: "down",
            uptimePercent: 94.2,
            latencyMs: 0,
            serviceId: "srv-1",
            heartbeats: [
              { status: "down", timestamp: "2026-11-15T20:01:00Z", latencyMs: 0, message: "502 Bad Gateway" },
            ],
          },
        ],
      },
    });

    // 1. Non-blocking unavailable banner
    expect(wrapper.text()).toContain("Uptime Kuma Integration Unavailable");

    // 2. Service item shows linked monitor status and uptime percentage alongside container status
    const serviceItem = wrapper.find(".service-item");
    expect(serviceItem.text()).toContain("running");
    expect(serviceItem.find(".service-kuma-badge").exists()).toBe(true);
    expect(serviceItem.find(".service-kuma-badge").text()).toContain("Kuma: down (94.2%)");

    // 3. Clicking service opens detail drawer with UptimeKumaMonitors and forwards linkMonitor
    await serviceItem.trigger("click");
    const kumaComp = wrapper.findComponent({ name: "UptimeKumaMonitors" });
    expect(kumaComp.exists()).toBe(true);

    await kumaComp.vm.$emit("linkMonitor", "mon-vw", "srv-1");
    expect(wrapper.emitted("linkMonitor")).toBeTruthy();
    expect(wrapper.emitted("linkMonitor")?.[0]).toEqual(["mon-vw", "srv-1"]);
  });

  it("renders n8n unavailable warning banner and embeds N8nWorkflows panel forwarding filter events", async () => {
    const wrapper = mount(Dashboard, {
      props: {
        integrationStatus: { docker: "available", n8n: "unavailable" },
        n8nSummary: { total: 2, active: 1, failedExecutions: 1 },
        n8nWorkflows: [
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
        ],
        n8nFailedExecutions: [
          {
            id: "ex-2",
            workflowId: "wf-2",
            workflowName: "Alert Webhook Relay",
            status: "error",
            startedAt: "2026-11-16T12:00:00Z",
            errorMessage: "Webhook auth rejected: Bearer [REDACTED]",
          },
        ],
      },
    });

    // 1. Non-blocking n8n unavailable warning banner
    expect(wrapper.text()).toContain("n8n Integration Unavailable");

    // 2. Embeds N8nWorkflows with workflows and failed executions
    const n8nComp = wrapper.findComponent({ name: "N8nWorkflows" });
    expect(n8nComp.exists()).toBe(true);
    expect(n8nComp.text()).toContain("Nightly Database Backup");
    expect(n8nComp.text()).toContain("Webhook auth rejected: Bearer [REDACTED]");

    // 3. Forwards filterFailedExecutions event
    await n8nComp.vm.$emit("filterFailedExecutions", { workflowId: "wf-2" });
    expect(wrapper.emitted("filterFailedExecutions")).toBeTruthy();
    expect(wrapper.emitted("filterFailedExecutions")?.[0]).toEqual([{ workflowId: "wf-2" }]);
  });

  it("renders MCP Server status badge and surfaces pending MCP-requested operation in service detail drawer for human confirmation", async () => {
    const wrapper = mount(Dashboard, {
      props: {
        mcpServerStatus: { enabled: true, toolCount: 5 },
        services: [
          {
            id: "srv-1",
            name: "vaultwarden",
            externalId: "vw-ctr",
            integration: "docker",
            status: "running",
          },
        ],
        pendingOperation: {
          id: "op-mcp-1",
          serviceId: "srv-1",
          action: "restart",
          riskLevel: "L2",
          status: "pending",
          actor: "mcp",
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          confirmationToken: "token-mcp-1",
          createdAt: new Date().toISOString(),
        },
      },
    });

    // 1. Renders MCP Server status badge in header
    const mcpBadge = wrapper.find(".mcp-server-status");
    expect(mcpBadge.exists()).toBe(true);
    expect(mcpBadge.text()).toContain("MCP Server Active (5 tools)");

    // 2. Selecting service surfaces the MCP-requested pending operation in the detail drawer for confirmation
    await wrapper.find(".service-item").trigger("click");
    const confirmBox = wrapper.find(".confirmation-dialog");
    expect(confirmBox.exists()).toBe(true);
    expect(confirmBox.text()).toContain("L2");
    expect(confirmBox.text()).toContain("restart");

    await confirmBox.find(".btn-confirm").trigger("click");
    expect(wrapper.emitted("confirmOperation")).toBeTruthy();
    expect(wrapper.emitted("confirmOperation")?.[0]).toEqual(["op-mcp-1", "token-mcp-1"]);
  });
});
