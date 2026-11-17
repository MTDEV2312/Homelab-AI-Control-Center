import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.ts";
import type { N8nClient } from "../src/interfaces/n8n.ts";

describe("GET /api/n8n/workflows", () => {
  it("returns workflows with active status, last execution status, and summary counts", async () => {
    const mockN8nClient: N8nClient = {
      async getWorkflows() {
        return [
          {
            id: "wf-1",
            name: "Nightly Database Backup",
            active: true,
            lastExecutionStatus: "success",
            updatedAt: "2026-11-16T02:00:00Z",
          },
          {
            id: "wf-2",
            name: "Alert Webhook Relay",
            active: true,
            lastExecutionStatus: "error",
            updatedAt: "2026-11-16T22:00:00Z",
          },
          {
            id: "wf-3",
            name: "Legacy Cleanup",
            active: false,
            lastExecutionStatus: "canceled",
            updatedAt: "2026-11-10T10:00:00Z",
          },
        ];
      },
      async getExecutions() {
        return [
          {
            id: "ex-1",
            workflowId: "wf-1",
            workflowName: "Nightly Database Backup",
            status: "success",
            startedAt: "2026-11-16T02:00:00Z",
            stoppedAt: "2026-11-16T02:00:05Z",
          },
          {
            id: "ex-2",
            workflowId: "wf-2",
            workflowName: "Alert Webhook Relay",
            status: "error",
            startedAt: "2026-11-16T22:00:00Z",
            stoppedAt: "2026-11-16T22:00:02Z",
            errorMessage: "Connection timeout",
          },
        ];
      },
    };

    const app = buildApp({ n8nClient: mockN8nClient });

    const res = await app.inject({
      method: "GET",
      url: "/api/n8n/workflows",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.integrationStatus).toBe("available");
    expect(body.summary).toEqual({
      total: 3,
      active: 2,
      failedExecutions: 1,
    });
    expect(body.workflows).toHaveLength(3);
    expect(body.workflows[0]).toMatchObject({
      id: "wf-1",
      name: "Nightly Database Backup",
      active: true,
      lastExecutionStatus: "success",
    });
    expect(body.workflows[1]).toMatchObject({
      id: "wf-2",
      name: "Alert Webhook Relay",
      active: true,
      lastExecutionStatus: "error",
    });
    expect(body.workflows[2]).toMatchObject({
      id: "wf-3",
      name: "Legacy Cleanup",
      active: false,
      lastExecutionStatus: "canceled",
    });
  });
});
