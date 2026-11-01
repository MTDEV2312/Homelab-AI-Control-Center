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
});
