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
        <li v-for="service in services" :key="service.id">
          <span class="service-name">{{ service.name }}</span>
          <span class="service-integration">{{ service.integration }}</span>
          <span class="service-status">{{ service.status }}</span>
          <span class="service-checked">{{ service.lastCheckedAt }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

export interface ServiceItem {
  id: string;
  name: string;
  externalId: string;
  integration: string;
  status: "running" | "stopped" | "unhealthy" | "unknown";
  lastCheckedAt?: string;
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
}>();

const form = ref({
  name: "",
  externalId: "",
});

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
