<template>
  <main class="container">
    <Dashboard
      :summary="data.summary"
      :integration-status="data.integrationStatus"
      :services="data.services"
      @register-service="handleRegister"
      @select-service="handleSelectService"
    />
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import Dashboard, { type Summary, type ServiceItem } from "./components/Dashboard.vue";

const data = ref<{
  summary: Summary;
  integrationStatus: { docker: string };
  services: ServiceItem[];
}>({
  summary: { total: 0, online: 0, unhealthy: 0 },
  integrationStatus: { docker: "available" },
  services: [],
});

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
  try {
    const res = await fetch(`/api/services/${service.id}`);
    if (res.ok) {
      const detailed = await res.json();
      const idx = data.value.services.findIndex((s) => s.id === service.id);
      if (idx !== -1) {
        data.value.services[idx] = detailed;
      }
    }
  } catch (error) {
    console.error("Failed to fetch service details", error);
  }
}

onMounted(() => {
  loadServices();
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
