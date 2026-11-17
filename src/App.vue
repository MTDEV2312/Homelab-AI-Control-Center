<template>
  <main class="container">
    <Dashboard
      :summary="data.summary"
      :integration-status="data.integrationStatus"
      :services="data.services"
      :logs="activeLogs"
      :health-history="activeHealthHistory"
      :webmcp-status="webmcpStatus"
      :assistant-response="assistantResponse"
      :assistant-loading="assistantLoading"
      :assistant-error="assistantError"
      :pending-operation="pendingOperation"
      :audit-log="activeAuditLog"
      :operations-loading="operationsLoading"
      :operations-error="operationsError"
      :incidents="activeIncidents"
      :uptime-kuma-monitors="uptimeKumaMonitors"
      :n8n-summary="n8nSummary"
      :n8n-workflows="n8nWorkflows"
      :n8n-failed-executions="n8nFailedExecutions"
      @register-service="handleRegister"
      @select-service="handleSelectService"
      @filter-logs="handleFilterLogs"
      @run-health-check="handleRunHealthCheck"
      @ask-ai-assistant="handleAskAiAssistant"
      @request-action="handleRequestAction"
      @confirm-operation="handleConfirmOperation"
      @cancel-operation="handleCancelOperation"
      @create-incident="handleCreateIncident"
      @update-incident="handleUpdateIncident"
      @link-monitor="handleLinkMonitor"
      @filter-failed-executions="handleFilterFailedExecutions"
    />
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import Dashboard, { type Summary, type ServiceItem, type WebMcpStatus } from "./components/Dashboard.vue";
import { registerWebMcpTools } from "./services/webmcp.ts";
import type { LogEntry, LogLevel, HealthCheckResult } from "./interfaces/service.ts";
import type { DiagnosticResponse } from "./interfaces/assistant.ts";
import type { OperationAction, PendingOperation, AuditEntry } from "./interfaces/operation.ts";
import type { Incident, CreateIncidentInput, UpdateIncidentInput } from "./interfaces/incident.ts";
import type { UptimeKumaMonitor } from "./interfaces/uptimeKuma.ts";
import type { N8nWorkflow, N8nExecution, N8nFailedExecutionFilter } from "./interfaces/n8n.ts";

const data = ref<{
  summary: Summary;
  integrationStatus: { docker: string; uptimeKuma?: string; n8n?: string };
  services: ServiceItem[];
}>({
  summary: { total: 0, online: 0, unhealthy: 0 },
  integrationStatus: { docker: "available" },
  services: [],
});

const webmcpStatus = ref<WebMcpStatus>({
  supported: false,
  registeredCount: 0,
});

const activeLogs = ref<LogEntry[]>([]);
const activeHealthHistory = ref<HealthCheckResult[]>([]);
const currentSelectedId = ref<string | null>(null);

const assistantResponse = ref<DiagnosticResponse | null>(null);
const assistantLoading = ref(false);
const assistantError = ref<string | null>(null);

const pendingOperation = ref<PendingOperation | null>(null);
const activeAuditLog = ref<AuditEntry[]>([]);
const operationsLoading = ref(false);
const operationsError = ref<string | null>(null);
const activeIncidents = ref<Incident[]>([]);
const uptimeKumaMonitors = ref<UptimeKumaMonitor[]>([]);
const n8nSummary = ref<{ total: number; active: number; failedExecutions: number }>({
  total: 0,
  active: 0,
  failedExecutions: 0,
});
const n8nWorkflows = ref<N8nWorkflow[]>([]);
const n8nFailedExecutions = ref<N8nExecution[]>([]);

async function fetchN8nData() {
  try {
    const [wfRes, execRes] = await Promise.all([
      fetch("/api/n8n/workflows"),
      fetch("/api/n8n/executions/failed"),
    ]);
    if (wfRes.ok) {
      const wfPayload = await wfRes.json();
      n8nSummary.value = wfPayload.summary || { total: 0, active: 0, failedExecutions: 0 };
      n8nWorkflows.value = wfPayload.workflows || [];
    }
    if (execRes.ok) {
      const execPayload = await execRes.json();
      n8nFailedExecutions.value = execPayload.executions || [];
    }
  } catch (error) {
    console.error("Failed to fetch n8n data", error);
  }
}

async function handleFilterFailedExecutions(filter: N8nFailedExecutionFilter) {
  try {
    const params = new URLSearchParams();
    if (filter.workflowId) params.append("workflowId", filter.workflowId);
    if (filter.since) params.append("since", filter.since);

    const query = params.toString();
    const res = await fetch(`/api/n8n/executions/failed${query ? `?${query}` : ""}`);
    if (res.ok) {
      const payload = await res.json();
      n8nFailedExecutions.value = payload.executions || [];
    }
  } catch (error) {
    console.error("Failed to filter n8n failed executions", error);
  }
}

async function fetchUptimeKumaMonitors() {
  try {
    const res = await fetch("/api/uptime-kuma/monitors");
    if (res.ok) {
      const payload = await res.json();
      uptimeKumaMonitors.value = payload.monitors || [];
    }
  } catch (error) {
    console.error("Failed to fetch Uptime Kuma monitors", error);
  }
}

async function handleLinkMonitor(monitorId: string, serviceId: string) {
  try {
    const res = await fetch(`/api/uptime-kuma/monitors/${monitorId}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId }),
    });
    if (res.ok) {
      await fetchUptimeKumaMonitors();
      await loadServices();
    }
  } catch (error) {
    console.error("Failed to link Uptime Kuma monitor", error);
  }
}

async function fetchIncidents(serviceId?: string) {
  try {
    const url = serviceId ? `/api/incidents?serviceId=${serviceId}` : "/api/incidents";
    const res = await fetch(url);
    if (res.ok) {
      activeIncidents.value = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch incidents", error);
  }
}

async function handleCreateIncident(input: CreateIncidentInput) {
  try {
    const res = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      await fetchIncidents(input.serviceId);
    }
  } catch (error) {
    console.error("Failed to create incident", error);
  }
}

async function handleUpdateIncident(id: string, input: UpdateIncidentInput) {
  try {
    const res = await fetch(`/api/incidents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      if (currentSelectedId.value) {
        await fetchIncidents(currentSelectedId.value);
      } else {
        await fetchIncidents();
      }
    }
  } catch (error) {
    console.error("Failed to update incident", error);
  }
}

async function fetchAuditLog(serviceId?: string) {
  try {
    const url = serviceId ? `/api/audit?serviceId=${serviceId}` : "/api/audit";
    const res = await fetch(url);
    if (res.ok) {
      activeAuditLog.value = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch audit log", error);
  }
}

async function handleRequestAction(action: OperationAction, serviceId: string) {
  operationsLoading.value = true;
  operationsError.value = null;
  try {
    const res = await fetch("/api/operations/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId, action }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to request operation");
    }
    pendingOperation.value = data.operation;
  } catch (err: any) {
    operationsError.value = err?.message || "Operation request failed";
  } finally {
    operationsLoading.value = false;
  }
}

async function handleConfirmOperation(operationId: string, confirmationToken: string) {
  operationsLoading.value = true;
  operationsError.value = null;
  try {
    const res = await fetch(`/api/operations/${operationId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to confirm operation");
    }
    pendingOperation.value = null;
    await loadServices();
    if (currentSelectedId.value) {
      await fetchAuditLog(currentSelectedId.value);
    }
  } catch (err: any) {
    operationsError.value = err?.message || "Operation confirmation failed";
  } finally {
    operationsLoading.value = false;
  }
}

function handleCancelOperation() {
  pendingOperation.value = null;
  operationsError.value = null;
}

async function handleAskAiAssistant(query: string, serviceId?: string) {
  assistantLoading.value = true;
  assistantError.value = null;
  try {
    const res = await fetch("/api/assistant/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, serviceId }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to execute diagnostic inquiry");
    }
    assistantResponse.value = data;
  } catch (err: any) {
    assistantError.value = err?.message || "Assistant error";
  } finally {
    assistantLoading.value = false;
  }
}

async function initWebMcp() {
  try {
    const res = await fetch("/api/tools");
    if (res.ok) {
      const { tools } = await res.json();
      const result = await registerWebMcpTools({ tools });
      webmcpStatus.value = {
        supported: result.supported,
        registeredCount: result.registeredTools.length,
      };

      if (!result.supported) {
        setTimeout(async () => {
          const retry = await registerWebMcpTools({ tools });
          if (retry.supported) {
            webmcpStatus.value = {
              supported: true,
              registeredCount: retry.registeredTools.length,
            };
          }
        }, 500);
      }
    }
  } catch (error) {
    console.warn("Failed to initialize WebMCP tools", error);
  }
}

async function loadServices() {
  try {
    const res = await fetch("/api/services");
    if (res.ok) {
      data.value = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch services", error);
  }
}

async function handleRegister(payload: { name: string; externalId: string; integration: string }) {
  try {
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      await loadServices();
    }
  } catch (error) {
    console.error("Failed to register service", error);
  }
}

async function handleSelectService(service: ServiceItem) {
  currentSelectedId.value = service.id;
  try {
    const res = await fetch(`/api/services/${service.id}`);
    if (res.ok) {
      const detailed = await res.json();
      const idx = data.value.services.findIndex((s) => s.id === service.id);
      if (idx !== -1) {
        data.value.services[idx] = detailed;
      }
    }

    await fetchLogs(service.id);
    await fetchHealthHistory(service.id);
    await fetchAuditLog(service.id);
    await fetchIncidents(service.id);
    await fetchUptimeKumaMonitors();
  } catch (error) {
    console.error("Failed to fetch service details", error);
  }
}

async function fetchHealthHistory(serviceId: string) {
  try {
    const res = await fetch(`/api/services/${serviceId}/health-checks`);
    if (res.ok) {
      const histData = await res.json();
      activeHealthHistory.value = histData.history || [];
    }
  } catch (error) {
    console.error("Failed to fetch health checks history", error);
  }
}

async function handleRunHealthCheck(serviceId: string) {
  try {
    const res = await fetch(`/api/services/${serviceId}/health-check`, {
      method: "POST",
    });
    if (res.ok) {
      await loadServices();
      await fetchHealthHistory(serviceId);
      const detailed = data.value.services.find((s) => s.id === serviceId);
      if (detailed) {
        handleSelectService(detailed);
      }
    }
  } catch (error) {
    console.error("Failed to execute health check", error);
  }
}

async function fetchLogs(serviceId: string, filters?: { query?: string; level?: LogLevel }) {
  try {
    const params = new URLSearchParams();
    if (filters?.query) params.append("query", filters.query);
    if (filters?.level) params.append("level", filters.level);

    const res = await fetch(`/api/services/${serviceId}/logs?${params.toString()}`);
    if (res.ok) {
      const logData = await res.json();
      activeLogs.value = logData.entries || [];
    }
  } catch (error) {
    console.error("Failed to fetch logs", error);
  }
}

async function handleFilterLogs(filters: { query: string; level?: LogLevel }) {
  if (currentSelectedId.value) {
    await fetchLogs(currentSelectedId.value, filters);
  }
}

onMounted(() => {
  loadServices();
  fetchUptimeKumaMonitors();
  fetchN8nData();
  initWebMcp();
});
</script>

<style>
body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background-color: #0f172a;
  color: #f8fafc;
}
.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
.header-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.webmcp-status {
  padding: 0.3rem 0.65rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}
.webmcp-status.active {
  background: #064e3b;
  color: #6ee7b7;
  border: 1px solid #059669;
}
.webmcp-status.inactive {
  background: #1e293b;
  color: #94a3b8;
  border: 1px solid #334155;
}
.summary-cards {
  display: flex;
  gap: 1rem;
  margin: 1.5rem 0;
}
.card {
  flex: 1;
  background: #1e293b;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #334155;
  font-weight: bold;
}
.banner.warning {
  background: #7f1d1d;
  color: #fca5a5;
  padding: 0.75rem;
  border-radius: 6px;
  margin: 1rem 0;
}
.service-registration form {
  display: flex;
  gap: 0.5rem;
  margin: 1.5rem 0;
}
input {
  flex: 1;
  padding: 0.6rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #fff;
}
button {
  padding: 0.6rem 1.2rem;
  background: #2563eb;
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-weight: 600;
}
button:hover {
  background: #1d4ed8;
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.service-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1e293b;
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
  border-radius: 6px;
  border: 1px solid #334155;
  cursor: pointer;
  transition: background 0.15s ease;
}
.service-item:hover {
  background: #273549;
}
.service-status {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
  text-transform: uppercase;
  background: #334155;
}
.service-latency {
  background: #0f172a;
  border: 1px solid #334155;
  color: #94a3b8;
  font-size: 0.8rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}
.service-failures {
  background: #7f1d1d;
  color: #fca5a5;
  font-size: 0.8rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}
.service-detail-panel {
  background: #1e293b;
  border: 1px solid #3b82f6;
  border-radius: 8px;
  padding: 1.25rem;
  margin-top: 1.5rem;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.close-btn {
  background: transparent;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #94a3b8;
  padding: 0.2rem 0.5rem;
}
.close-btn:hover {
  color: #fff;
  background: #334155;
}
.metrics-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}
.metric-item {
  background: #0f172a;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid #334155;
}
.metrics-notice {
  margin-top: 1rem;
  color: #94a3b8;
}
</style>
