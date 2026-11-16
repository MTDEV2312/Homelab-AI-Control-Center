<template>
  <div class="uptime-kuma-monitors">
    <h4>Uptime Kuma Monitors</h4>

    <div v-if="monitors.length === 0" class="empty-state">
      No Uptime Kuma monitors available.
    </div>

    <div
      v-for="mon in monitors"
      :key="mon.id"
      :data-monitor-id="mon.id"
      class="monitor-card"
      :class="mon.status"
    >
      <div class="monitor-header">
        <div class="header-left">
          <span class="monitor-name">{{ mon.name }}</span>
          <span class="monitor-status" :class="mon.status">{{ mon.status }}</span>
          <span v-if="serviceId && mon.serviceId === serviceId" class="linked-badge">
            Linked to this service
          </span>
        </div>
        <div class="header-metrics">
          <span class="monitor-uptime">{{ mon.uptimePercent }}%</span>
          <span class="monitor-latency">{{ mon.latencyMs }}ms</span>
        </div>
      </div>

      <div v-if="mon.url" class="monitor-url">{{ mon.url }}</div>

      <div class="heartbeat-bars">
        <span
          v-for="(hb, idx) in mon.heartbeats"
          :key="idx"
          class="heartbeat-bar"
          :class="hb.status"
          :title="hb.message || `${hb.status} (${hb.latencyMs}ms)`"
        ></span>
      </div>

      <p v-if="latestMessage(mon)" class="heartbeat-message">
        {{ latestMessage(mon) }}
      </p>

      <div v-if="serviceId" class="monitor-actions">
        <button
          type="button"
          data-action="link-monitor"
          class="btn btn-link"
          @click="emit('linkMonitor', mon.id, serviceId)"
        >
          {{ mon.serviceId === serviceId ? "Linked" : "Link to Service" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { UptimeKumaMonitor } from "../interfaces/uptimeKuma.ts";

withDefaults(
  defineProps<{
    serviceId?: string;
    monitors?: UptimeKumaMonitor[];
  }>(),
  {
    serviceId: "",
    monitors: () => [],
  }
);

const emit = defineEmits<{
  (e: "linkMonitor", monitorId: string, serviceId: string): void;
}>();

function latestMessage(mon: UptimeKumaMonitor): string | undefined {
  for (let i = mon.heartbeats.length - 1; i >= 0; i--) {
    if (mon.heartbeats[i].message) {
      return mon.heartbeats[i].message;
    }
  }
  return undefined;
}
</script>

<style scoped>
.uptime-kuma-monitors {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #18191f;
  border: 1px solid #2d3139;
  border-radius: 6px;
}

.uptime-kuma-monitors h4 {
  margin: 0 0 0.75rem 0;
  color: #f3f4f6;
}

.empty-state {
  color: #9ca3af;
  font-size: 0.85rem;
}

.monitor-card {
  background: #20242c;
  border: 1px solid #374151;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
}

.monitor-card.up {
  border-left: 4px solid #10b981;
}

.monitor-card.down {
  border-left: 4px solid #ef4444;
}

.monitor-card.pending {
  border-left: 4px solid #f59e0b;
}

.monitor-card.maintenance {
  border-left: 4px solid #3b82f6;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.header-left,
.header-metrics {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.monitor-name {
  font-weight: 600;
  color: #f9fafb;
}

.monitor-status {
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.monitor-status.up {
  background: #064e3b;
  color: #a7f3d0;
}

.monitor-status.down {
  background: #7f1d1d;
  color: #fecaca;
}

.monitor-status.pending {
  background: #78350f;
  color: #fde68a;
}

.monitor-status.maintenance {
  background: #1e3a8a;
  color: #bfdbfe;
}

.linked-badge {
  background: #1e3a8a;
  color: #bfdbfe;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.monitor-uptime {
  color: #34d399;
  font-weight: 600;
  font-size: 0.85rem;
}

.monitor-latency {
  color: #9ca3af;
  font-size: 0.8rem;
}

.monitor-url {
  color: #9ca3af;
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.heartbeat-bars {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.heartbeat-bar {
  width: 8px;
  height: 18px;
  border-radius: 2px;
  display: inline-block;
}

.heartbeat-bar.up {
  background: #10b981;
}

.heartbeat-bar.down {
  background: #ef4444;
}

.heartbeat-bar.pending {
  background: #f59e0b;
}

.heartbeat-bar.maintenance {
  background: #3b82f6;
}

.heartbeat-message {
  color: #fca5a5;
  font-size: 0.8rem;
  margin: 0.4rem 0 0 0;
}

.monitor-actions {
  margin-top: 0.5rem;
  display: flex;
  justify-content: flex-end;
}

.btn-link {
  padding: 0.3rem 0.6rem;
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}
</style>
