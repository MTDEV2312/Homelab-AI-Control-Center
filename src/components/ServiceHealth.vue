<template>
  <div class="service-health">
    <div class="health-header">
      <h4>Health Monitoring</h4>
      <button class="run-check-btn" @click="emit('runCheck', serviceId)">
        Run Health Check
      </button>
    </div>

    <div v-if="healthCheck" class="latest-health">
      <span class="health-status" :class="healthCheck.status">{{ healthCheck.status }}</span>
      <span class="latency-badge">{{ healthCheck.latencyMs }}ms</span>
      <span v-if="consecutiveFailures > 0" class="consecutive-failures">
        {{ consecutiveFailures }} consecutive failures
      </span>
      <span v-if="healthCheck.errorCode" class="error-code">({{ healthCheck.errorCode }})</span>
    </div>
    <div v-else class="no-health">
      <em>No health check recorded yet.</em>
    </div>

    <div v-if="history && history.length > 0" class="health-history">
      <h5>Recent Checks</h5>
      <div v-for="item in history" :key="item.id" class="health-history-item">
        <span class="check-time">{{ item.checkedAt }}</span>
        <span class="check-status" :class="item.status">{{ item.status }}</span>
        <span class="check-latency">{{ item.latencyMs }}ms</span>
        <span v-if="item.errorCode" class="check-error">[{{ item.errorCode }}]</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HealthCheckResult } from "../interfaces/service.ts";

const props = withDefaults(
  defineProps<{
    serviceId: string;
    healthCheck?: HealthCheckResult;
    consecutiveFailures?: number;
    history?: HealthCheckResult[];
  }>(),
  {
    consecutiveFailures: 0,
    history: () => [],
  }
);

const emit = defineEmits<{
  (e: "runCheck", serviceId: string): void;
}>();
</script>

<style scoped>
.service-health {
  margin-top: 1rem;
  background: #0f172a;
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid #334155;
}
.health-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}
.health-header h4 {
  margin: 0;
}
.run-check-btn {
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}
.run-check-btn:hover {
  background: #1d4ed8;
}
.latest-health {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.95rem;
}
.health-status {
  font-weight: bold;
  text-transform: uppercase;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}
.health-status.healthy {
  background: #065f46;
  color: #34d399;
}
.health-status.unhealthy {
  background: #7f1d1d;
  color: #f87171;
}
.latency-badge {
  background: #334155;
  color: #f8fafc;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}
.consecutive-failures {
  background: #991b1b;
  color: #fecaca;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
}
.error-code {
  color: #f87171;
}
.health-history {
  margin-top: 1rem;
}
.health-history h5 {
  margin: 0 0 0.5rem 0;
  color: #94a3b8;
}
.health-history-item {
  display: flex;
  gap: 0.75rem;
  font-size: 0.8rem;
  font-family: monospace;
  padding: 0.25rem 0;
  border-bottom: 1px solid #1e293b;
}
.check-time {
  color: #64748b;
}
.check-status.healthy {
  color: #34d399;
}
.check-status.unhealthy {
  color: #f87171;
}
.check-latency {
  color: #cbd5e1;
}
.check-error {
  color: #f87171;
}
</style>
