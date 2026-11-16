// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import UptimeKumaMonitors from "../../src/components/UptimeKumaMonitors.vue";
import type { UptimeKumaMonitor } from "../../src/interfaces/uptimeKuma.ts";

describe("UptimeKumaMonitors component", () => {
  it("renders monitor list, uptime percentage, heartbeat history bars, and emits linkMonitor event", async () => {
    const monitors: UptimeKumaMonitor[] = [
      {
        id: "mon-1",
        name: "Jellyfin External HTTPS",
        url: "https://media.homelab.local",
        status: "up",
        uptimePercent: 99.85,
        latencyMs: 42,
        serviceId: "srv-1",
        heartbeats: [
          { status: "up", timestamp: "2026-11-15T20:00:00Z", latencyMs: 40 },
          { status: "up", timestamp: "2026-11-15T20:01:00Z", latencyMs: 42 },
        ],
      },
      {
        id: "mon-2",
        name: "Vaultwarden Public Endpoint",
        url: "https://vault.homelab.local",
        status: "down",
        uptimePercent: 94.2,
        latencyMs: 0,
        heartbeats: [
          { status: "up", timestamp: "2026-11-15T20:00:00Z", latencyMs: 35 },
          {
            status: "down",
            timestamp: "2026-11-15T20:01:00Z",
            latencyMs: 0,
            message: "502 Bad Gateway",
          },
        ],
      },
    ];

    const wrapper = mount(UptimeKumaMonitors, {
      props: {
        serviceId: "srv-1",
        monitors,
      },
    });

    // 1. Renders monitor names, uptime percentages, and latency
    expect(wrapper.text()).toContain("Jellyfin External HTTPS");
    expect(wrapper.text()).toContain("99.85%");
    expect(wrapper.text()).toContain("42ms");
    expect(wrapper.text()).toContain("Vaultwarden Public Endpoint");
    expect(wrapper.text()).toContain("94.2%");
    expect(wrapper.text()).toContain("502 Bad Gateway");

    // 2. Renders heartbeat history bars with status classes
    const mon1Card = wrapper.find('[data-monitor-id="mon-1"]');
    expect(mon1Card.exists()).toBe(true);
    expect(mon1Card.findAll(".heartbeat-bar.up")).toHaveLength(2);

    const mon2Card = wrapper.find('[data-monitor-id="mon-2"]');
    expect(mon2Card.exists()).toBe(true);
    expect(mon2Card.findAll(".heartbeat-bar.up")).toHaveLength(1);
    expect(mon2Card.findAll(".heartbeat-bar.down")).toHaveLength(1);

    // 3. Emits linkMonitor when linking a monitor to the current service
    const linkBtn = mon2Card.find('button[data-action="link-monitor"]');
    expect(linkBtn.exists()).toBe(true);
    await linkBtn.trigger("click");

    expect(wrapper.emitted("linkMonitor")).toBeTruthy();
    expect(wrapper.emitted("linkMonitor")?.[0]).toEqual(["mon-2", "srv-1"]);
  });
});
