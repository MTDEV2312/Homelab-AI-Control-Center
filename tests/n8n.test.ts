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

describe("GET /api/n8n/executions/failed", () => {
  it("returns failed executions with redacted error messages and supports workflowId and since filtering", async () => {
    const mockN8nClient: N8nClient = {
      async getWorkflows() {
        return [];
      },
      async getExecutions() {
        return [
          {
            id: "ex-1",
            workflowId: "wf-1",
            workflowName: "Nightly Database Backup",
            status: "success",
            startedAt: "2026-11-16T10:00:00Z",
            stoppedAt: "2026-11-16T10:00:05Z",
          },
          {
            id: "ex-2",
            workflowId: "wf-2",
            workflowName: "Alert Webhook Relay",
            status: "error",
            startedAt: "2026-11-16T12:00:00Z",
            stoppedAt: "2026-11-16T12:00:03Z",
            errorMessage: "Webhook auth rejected: Bearer sample_bearer_value",
          },
          {
            id: "ex-3",
            workflowId: "wf-3",
            workflowName: "Backup Sync",
            status: "error",
            startedAt: "2026-11-16T20:00:00Z",
            stoppedAt: "2026-11-16T20:00:04Z",
            errorMessage: "Remote API rejected token=sample_token_value",
          },
        ];
      },
    };

    const app = buildApp({ n8nClient: mockN8nClient });

    // 1. Unfiltered returns only failed executions with redacted error messages
    const allFailedRes = await app.inject({
      method: "GET",
      url: "/api/n8n/executions/failed",
    });
    expect(allFailedRes.statusCode).toBe(200);
    const allFailedBody = allFailedRes.json();
    expect(allFailedBody.integrationStatus).toBe("available");
    expect(allFailedBody.executions).toHaveLength(2);
    expect(allFailedBody.executions[0]).toMatchObject({
      id: "ex-2",
      workflowId: "wf-2",
      workflowName: "Alert Webhook Relay",
      status: "error",
      errorMessage: "Webhook auth rejected: Bearer [REDACTED]",
    });
    expect(allFailedBody.executions[1]).toMatchObject({
      id: "ex-3",
      workflowId: "wf-3",
      workflowName: "Backup Sync",
      status: "error",
      errorMessage: "Remote API rejected token=[REDACTED]",
    });

    // 2. Filter by workflowId
    const byWfRes = await app.inject({
      method: "GET",
      url: "/api/n8n/executions/failed?workflowId=wf-2",
    });
    expect(byWfRes.statusCode).toBe(200);
    expect(byWfRes.json().executions).toHaveLength(1);
    expect(byWfRes.json().executions[0].id).toBe("ex-2");

    // 3. Filter by since timestamp
    const sinceRes = await app.inject({
      method: "GET",
      url: "/api/n8n/executions/failed?since=2026-11-16T18:00:00Z",
    });
    expect(sinceRes.statusCode).toBe(200);
    expect(sinceRes.json().executions).toHaveLength(1);
    expect(sinceRes.json().executions[0].id).toBe("ex-3");
  });
});
