<template>
  <div class="dashboard">
    <header>
      <h1>Homelab Control Center</h1>
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
          <span class="service-status">{{ service.status }}</span>
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
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

export interface ServiceItem {
  id: string;
  name: string;
  externalId: string;
  integration: string;
  status: "running" | "stopped" | "unhealthy" | "unknown";
  lastCheckedAt?: string;
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

const props = withDefaults(
  defineProps<{
    summary?: Summary;
    integrationStatus?: { docker?: string };
    services?: ServiceItem[];
  }>(),
  {
    summary: () => ({ total: 0, online: 0, unhealthy: 0 }),
    integrationStatus: () => ({ docker: "available" }),
    services: () => [],
  }
);

const emit = defineEmits<{
  (e: "registerService", payload: { name: string; externalId: string; integration: string }): void;
  (e: "selectService", service: ServiceItem): void;
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
