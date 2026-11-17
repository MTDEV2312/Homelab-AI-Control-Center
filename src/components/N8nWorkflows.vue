<template>
  <section class="n8n-workflows">
    <div class="n8n-header">
      <h3>n8n Automations</h3>
      <div class="n8n-summary">
        <span class="summary-chip">Total Workflows: {{ summary.total }}</span>
        <span class="summary-chip active">Active: {{ summary.active }}</span>
        <span class="summary-chip failed">Failed Executions: {{ summary.failedExecutions }}</span>
      </div>
    </div>

    <div class="workflows-section">
      <h4>Workflows</h4>
      <div v-if="workflows.length === 0" class="empty-state">
        No n8n workflows found.
      </div>
      <ul v-else class="workflow-list">
        <li
          v-for="wf in workflows"
          :key="wf.id"
          :data-workflow-id="wf.id"
          class="workflow-item"
        >
          <div class="workflow-info">
            <span class="workflow-name">{{ wf.name }}</span>
            <span class="workflow-state" :class="wf.active ? 'active' : 'inactive'">
              {{ wf.active ? "active" : "inactive" }}
            </span>
          </div>
          <span
            v-if="wf.lastExecutionStatus"
            class="workflow-last-status"
            :class="wf.lastExecutionStatus"
          >
            {{ wf.lastExecutionStatus }}
          </span>
        </li>
      </ul>
    </div>

    <div class="executions-section">
      <div class="executions-header">
        <h4>Failed Executions</h4>
        <select
          v-model="selectedWorkflowId"
          data-field="workflowFilter"
          class="filter-select"
          @change="handleFilterChange"
        >
          <option value="">All Workflows</option>
          <option v-for="wf in workflows" :key="wf.id" :value="wf.id">
            {{ wf.name }}
          </option>
        </select>
      </div>

      <div v-if="failedExecutions.length === 0" class="empty-state">
        No failed executions recorded.
      </div>
      <ul v-else class="execution-list">
        <li
          v-for="ex in failedExecutions"
          :key="ex.id"
          :data-execution-id="ex.id"
          class="failed-execution-item"
        >
          <div class="execution-meta">
            <span class="execution-workflow">{{ ex.workflowName }}</span>
            <span class="execution-time">{{ ex.startedAt }}</span>
          </div>
          <p v-if="ex.errorMessage" class="execution-error">{{ ex.errorMessage }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { N8nWorkflow, N8nExecution } from "../interfaces/n8n.ts";

withDefaults(
  defineProps<{
    summary?: { total: number; active: number; failedExecutions: number };
    workflows?: N8nWorkflow[];
    failedExecutions?: N8nExecution[];
  }>(),
  {
    summary: () => ({ total: 0, active: 0, failedExecutions: 0 }),
    workflows: () => [],
    failedExecutions: () => [],
  }
);

const emit = defineEmits<{
  (e: "filterFailedExecutions", filter: { workflowId?: string }): void;
}>();

const selectedWorkflowId = ref("");

function handleFilterChange() {
  emit(
    "filterFailedExecutions",
    selectedWorkflowId.value ? { workflowId: selectedWorkflowId.value } : {}
  );
}
</script>

<style scoped>
.n8n-workflows {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
}

.n8n-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.n8n-header h3 {
  margin: 0;
  color: #f8fafc;
}

.n8n-summary {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.summary-chip {
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  background: #0f172a;
  color: #cbd5e1;
  border: 1px solid #334155;
}

.summary-chip.active {
  color: #6ee7b7;
  border-color: #059669;
}

.summary-chip.failed {
  color: #fca5a5;
  border-color: #dc2626;
}

.workflows-section,
.executions-section {
  margin-top: 1rem;
}

.workflows-section h4,
.executions-section h4 {
  margin: 0 0 0.5rem 0;
  color: #e2e8f0;
  font-size: 0.95rem;
}

.executions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.filter-select {
  padding: 0.35rem 0.6rem;
  background: #0f172a;
  border: 1px solid #475569;
  border-radius: 4px;
  color: #f8fafc;
  font-size: 0.85rem;
}

.empty-state {
  color: #94a3b8;
  font-size: 0.85rem;
}

.workflow-list,
.execution-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.workflow-item,
.failed-execution-item {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 0.6rem 0.85rem;
}

.workflow-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.workflow-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.workflow-name,
.execution-workflow {
  font-weight: 600;
  color: #f8fafc;
}

.workflow-state,
.workflow-last-status {
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.workflow-state.active {
  background: #064e3b;
  color: #a7f3d0;
}

.workflow-state.inactive {
  background: #334155;
  color: #cbd5e1;
}

.workflow-last-status.success {
  background: #064e3b;
  color: #a7f3d0;
}

.workflow-last-status.error {
  background: #7f1d1d;
  color: #fecaca;
}

.workflow-last-status.canceled {
  background: #334155;
  color: #94a3b8;
}

.execution-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.execution-time {
  font-size: 0.8rem;
  color: #94a3b8;
}

.execution-error {
  margin: 0.4rem 0 0 0;
  font-size: 0.85rem;
  color: #fca5a5;
  font-family: monospace;
}
</style>
