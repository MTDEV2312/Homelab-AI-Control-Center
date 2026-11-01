<template>
  <div class="service-logs">
    <div class="logs-filter-bar">
      <input
        v-model="query"
        name="logQuery"
        placeholder="Filter logs by text..."
        @input="emitFilterChange"
      />
      <select v-model="level" name="logLevel" @change="emitFilterChange">
        <option value="">All Levels</option>
        <option value="info">Info</option>
        <option value="warn">Warn</option>
        <option value="error">Error</option>
      </select>
    </div>

    <div class="logs-list">
      <div
        v-for="(log, idx) in logs"
        :key="idx"
        class="log-entry"
      >
        <span class="log-timestamp">{{ log.timestamp }}</span>
        <span class="log-level" :class="log.level">{{ log.level }}</span>
        <span class="log-message">{{ log.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { LogEntry, LogLevel } from "../interfaces/service.ts";

const props = withDefaults(
  defineProps<{
    logs?: LogEntry[];
  }>(),
  {
    logs: () => [],
  }
);

const emit = defineEmits<{
  (e: "filterChange", filters: { query: string; level?: LogLevel }): void;
}>();

const query = ref("");
const level = ref<LogLevel | "">("");

function emitFilterChange() {
  emit("filterChange", {
    query: query.value,
    level: level.value || undefined,
  });
}
</script>

<style scoped>
.service-logs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}
.logs-filter-bar {
  display: flex;
  gap: 0.5rem;
}
.logs-filter-bar input {
  flex: 1;
  padding: 0.5rem;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #fff;
}
.logs-filter-bar select {
  padding: 0.5rem;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #fff;
}
.logs-list {
  max-height: 320px;
  overflow-y: auto;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.85rem;
  padding: 0.5rem;
}
.log-entry {
  display: flex;
  gap: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-bottom: 1px solid #1e293b;
}
.log-timestamp {
  color: #64748b;
  white-space: nowrap;
}
.log-level {
  font-weight: bold;
  text-transform: uppercase;
}
.log-level.info {
  color: #38bdf8;
}
.log-level.warn {
  color: #facc15;
}
.log-level.error {
  color: #f87171;
}
.log-message {
  color: #e2e8f0;
  word-break: break-all;
}
</style>
