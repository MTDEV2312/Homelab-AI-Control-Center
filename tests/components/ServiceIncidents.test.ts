// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ServiceIncidents from "../../src/components/ServiceIncidents.vue";
import type { Incident } from "../../src/interfaces/incident.ts";

describe("ServiceIncidents component", () => {
  it("renders incident history, separates hypotheses from confirmed cause, and emits create/update events", async () => {
    const incidents: Incident[] = [
      {
        id: "inc-1",
        serviceId: "srv-1",
        title: "High CPU and 502 gateway errors",
        severity: "high",
        status: "open",
        description: "Container jellyfin unreachable from reverse proxy",
        startedAt: "2026-11-04T12:00:00Z",
        hypotheses: ["Transcoder memory leak", "OOM killed child process"],
        evidence: ["CPU at 98%", "Log error: gateway timeout 502"],
        actions: ["restart"],
      },
      {
        id: "inc-2",
        serviceId: "srv-1",
        title: "Vault synchronization locked",
        severity: "critical",
        status: "resolved",
        startedAt: "2026-11-04T10:00:00Z",
        resolvedAt: "2026-11-04T11:00:00Z",
        hypotheses: ["SQLite database locked by concurrent backup"],
        evidence: ["Found stuck backup cron job holding db lock"],
        actions: ["kill 4521", "restart"],
        confirmedCause: "Stuck backup script held exclusive lock on sqlite file",
        resolutionNotes: "Killed stuck cron process and restarted container",
      },
    ];

    const wrapper = mount(ServiceIncidents, {
      props: {
        serviceId: "srv-1",
        incidents,
      },
    });

    // 1. Renders existing incidents
    expect(wrapper.text()).toContain("High CPU and 502 gateway errors");
    expect(wrapper.text()).toContain("Vault synchronization locked");

    // 2. Clear visual separation between hypotheses and confirmed cause
    const resolvedCard = wrapper.find('[data-incident-id="inc-2"]');
    expect(resolvedCard.exists()).toBe(true);

    const hypothesesEl = resolvedCard.find(".incident-hypotheses");
    expect(hypothesesEl.exists()).toBe(true);
    expect(hypothesesEl.text()).toContain("SQLite database locked by concurrent backup");

    const confirmedCauseEl = resolvedCard.find(".incident-confirmed-cause");
    expect(confirmedCauseEl.exists()).toBe(true);
    expect(confirmedCauseEl.text()).toContain("Stuck backup script held exclusive lock on sqlite file");
    expect(confirmedCauseEl.text()).toContain("Killed stuck cron process and restarted container");

    // 3. Form to create a new incident
    const titleInput = wrapper.find('input[data-field="title"]');
    const descInput = wrapper.find('textarea[data-field="description"]');
    const severitySelect = wrapper.find('select[data-field="severity"]');
    const hypothesesInput = wrapper.find('input[data-field="hypotheses"]');
    const evidenceInput = wrapper.find('input[data-field="evidence"]');
    const createBtn = wrapper.find('button[data-action="create-incident"]');

    await titleInput.setValue("Disk full on /var/lib/docker");
    await descInput.setValue("Docker storage driver out of space");
    await severitySelect.setValue("critical");
    await hypothesesInput.setValue("Dangling images, Old container logs");
    await evidenceInput.setValue("df -h shows 100% on overlay");
    await createBtn.trigger("click");

    expect(wrapper.emitted("createIncident")).toBeTruthy();
    expect(wrapper.emitted("createIncident")?.[0][0]).toMatchObject({
      serviceId: "srv-1",
      title: "Disk full on /var/lib/docker",
      description: "Docker storage driver out of space",
      severity: "critical",
      hypotheses: ["Dangling images", "Old container logs"],
      evidence: ["df -h shows 100% on overlay"],
    });

    // 4. Update status and resolve incident
    const openCard = wrapper.find('[data-incident-id="inc-1"]');
    const resolveBtn = openCard.find('button[data-action="resolve"]');
    expect(resolveBtn.exists()).toBe(true);

    const causeInput = openCard.find('input[data-field="confirmedCause"]');
    expect(causeInput.exists()).toBe(true);
    await causeInput.setValue("Transcoder memory exhaustion");
    await resolveBtn.trigger("click");

    expect(wrapper.emitted("updateIncident")).toBeTruthy();
    const updateCall = wrapper.emitted("updateIncident")?.[0];
    expect(updateCall?.[0]).toBe("inc-1");
    expect(updateCall?.[1]).toMatchObject({
      status: "resolved",
      confirmedCause: "Transcoder memory exhaustion",
    });
  });
});
