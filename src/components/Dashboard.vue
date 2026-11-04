<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <div class="header-main">
        <h1>Homelab Control Center</h1>
        <span
          class="webmcp-status"
          :class="{ active: webmcpStatus?.supported, inactive: !webmcpStatus?.supported }"
        >
          {{ webmcpStatus?.supported ? `WebMCP Active (${webmcpStatus.registeredCount} tools)` : 'WebMCP Unavailable' }}
        </span>
      </div>
      <div v-if="integrationStatus.docker === 'unavailable'" class="banner warning">
        Docker Integration Unavailable
      </div>
    </header>

    <section class="summary-cards">
      <div class="card">Total Services: {{ summary.total }}</div>
      <div class="card">Online: {{ summary.online }}</div>
      <div class="card">Unhealthy: {{ summary.unhealthy }}</div>
    </section>

    <section class="service-registration">
      <form @submit.prevent="handleSubmit">
        <input v-model="form.name" name="name" placeholder="Service Name" required />
        <input v-model="form.externalId" name="externalId" placeholder="Container ID / Name" required />
        <button type="submit">Register Service</button>
      </form>
    </section>

    <section class="service-list">
      <ul>
        <li
          v-for="service in services"
          :key="service.id"
          class="service-item"
          @click="selectService(service)"
        >
          <span class="service-name">{{ service.name }}</span>
          <span class="service-integration">{{ service.integration }}</span>
          <span v-if="service.healthCheck" class="service-latency">{{ service.healthCheck.latencyMs }}ms</span>
          <span v-if="service.consecutiveFailures" class="service-failures">{{ service.consecutiveFailures }} failed</span>
          <span class="service-status" :class="service.status">{{ service.status }}</span>
          <span class="service-checked">{{ service.lastCheckedAt }}</span>
        </li>
      </ul>
    </section>

    <aside v-if="selectedService" class="service-detail-panel">
      <div class="panel-header">
        <h3>{{ selectedService.name }} Details</h3>
        <button class="close-btn" @click="selectedId = null">✕</button>
      </div>
      <p>Container: {{ selectedService.externalId }}</p>
      <p>Status: {{ selectedService.status }}</p>

      <div v-if="selectedService.metrics?.available" class="metrics-cards">
        <div class="metric-item">
          <strong>CPU Usage:</strong> {{ selectedService.metrics.cpuPercent }}%
        </div>
        <div class="metric-item">
          <strong>Memory Usage:</strong>
          {{ selectedService.metrics.memoryUsedBytes }} / {{ selectedService.metrics.memoryLimitBytes }}
        </div>
        <div v-if="selectedService.metrics.uptimeSeconds !== undefined" class="metric-item">
          <strong>Uptime:</strong> {{ selectedService.metrics.uptimeSeconds }}s
        </div>
      </div>
      <div v-else class="metrics-notice">
        <em>Metrics unavailable: {{ selectedService.metrics?.reason || 'No metrics' }}</em>
      </div>

      <ServiceHealth
        :service-id="selectedService.id"
        :health-check="selectedService.healthCheck"
        :consecutive-failures="selectedService.consecutiveFailures"
        :history="healthHistory"
        @run-check="(id) => emit('runHealthCheck', id)"
      />

      <h4>Container Logs</h4>
      <ServiceLogs :logs="logs" @filter-change="(f) => emit('filterLogs', f)" />

      <AiAssistant
        :service-id="selectedService.id"
        :service-name="selectedService.name"
        :diagnostic-response="assistantResponse"
        :is-loading="assistantLoading"
        :error="assistantError"
        @ask="(q, id) => emit('askAiAssistant', q, id)"
      />
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import ServiceLogs from "./ServiceLogs.vue";
import ServiceHealth from "./ServiceHealth.vue";
import AiAssistant from "./AiAssistant.vue";
import type { LogEntry, LogLevel, HealthCheckResult } from "../interfaces/service.ts";
import type { DiagnosticResponse } from "../interfaces/assistant.ts";

export interface ServiceItem {
  id: string;
  name: string;
  externalId: string;
  integration: string;
  status: "running" | "stopped" | "unhealthy" | "unknown";
  lastCheckedAt?: string;
  consecutiveFailures?: number;
  healthCheck?: HealthCheckResult;
  metrics?: {
    available: boolean;
    reason?: string;
    cpuPercent?: number;
    memoryUsedBytes?: number;
    memoryLimitBytes?: number;
    uptimeSeconds?: number;
  };
}

export interface Summary {
  total: number;
  online: number;
  unhealthy: number;
}

export interface WebMcpStatus {
  supported: boolean;
  registeredCount: number;
}

const props = withDefaults(
  defineProps<{
    summary?: Summary;
    integrationStatus?: { docker?: string };
    services?: ServiceItem[];
    logs?: LogEntry[];
    healthHistory?: HealthCheckResult[];
    webmcpStatus?: WebMcpStatus;
    assistantResponse?: DiagnosticResponse | null;
    assistantLoading?: boolean;
    assistantError?: string | null;
  }>(),
  {
    summary: () => ({ total: 0, online: 0, unhealthy: 0 }),
    integrationStatus: () => ({ docker: "available" }),
    services: () => [],
    logs: () => [],
    healthHistory: () => [],
    webmcpStatus: () => ({ supported: false, registeredCount: 0 }),
    assistantResponse: null,
    assistantLoading: false,
    assistantError: null,
  }
);

const emit = defineEmits<{
  (e: "registerService", payload: { name: string; externalId: string; integration: string }): void;
  (e: "selectService", service: ServiceItem): void;
  (e: "filterLogs", filters: { query: string; level?: LogLevel }): void;
  (e: "runHealthCheck", serviceId: string): void;
  (e: "askAiAssistant", query: string, serviceId?: string): void;
}>();

const form = ref({
  name: "",
  externalId: "",
});

const selectedId = ref<string | null>(null);
const selectedService = computed(() =>
  props.services.find((s) => s.id === selectedId.value) ?? null
);

function selectService(service: ServiceItem) {
  selectedId.value = service.id;
  emit("selectService", service);
}

function handleSubmit() {
  emit("registerService", {
    name: form.value.name,
    externalId: form.value.externalId,
    integration: "docker",
  });
  form.value.name = "";
  form.value.externalId = "";
}
</script>
