<template>
  <div class="service-operations">
    <h4>Service Operations</h4>

    <div class="actions-bar">
      <button
        v-if="isActionAllowed('start')"
        data-action="start"
        class="btn btn-action"
        :disabled="isLoading"
        @click="emit('requestAction', 'start', serviceId)"
      >
        Start
      </button>
      <button
        v-if="isActionAllowed('restart')"
        data-action="restart"
        class="btn btn-action"
        :disabled="isLoading"
        @click="emit('requestAction', 'restart', serviceId)"
      >
        Restart
      </button>
      <button
        v-if="isActionAllowed('stop')"
        data-action="stop"
        class="btn btn-action btn-stop"
        :disabled="isLoading"
        @click="emit('requestAction', 'stop', serviceId)"
      >
        Stop
      </button>
    </div>

    <!-- Confirmation Modal / Dialog -->
    <div v-if="pendingOperation" class="confirmation-dialog">
      <div class="confirmation-header">
        <span class="warning-title">Confirm Operation</span>
        <span class="risk-badge" :class="pendingOperation.riskLevel.toLowerCase()">
          {{ pendingOperation.riskLevel }}
        </span>
      </div>
      <p class="confirmation-message">
        Are you sure you want to <strong>{{ pendingOperation.action }}</strong> service
        <em>{{ serviceName || serviceId }}</em>?
      </p>
      <div class="confirmation-actions">
        <button
          type="button"
          class="btn btn-confirm"
          :disabled="isLoading"
          @click="emit('confirmOperation', pendingOperation.id, pendingOperation.confirmationToken)"
        >
          {{ isLoading ? "Executing..." : "Confirm" }}
        </button>
        <button
          type="button"
          class="btn btn-cancel"
          :disabled="isLoading"
          @click="emit('cancelOperation')"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Audit Trail -->
    <div class="audit-trail">
      <h5>Audit Trail</h5>
      <div v-if="auditLog.length === 0" class="audit-empty">
        No operations recorded yet.
      </div>
      <ul v-else class="audit-list">
        <li v-for="entry in auditLog" :key="entry.id" class="audit-item">
          <span class="audit-time">{{ formatTime(entry.timestamp) }}</span>
          <span class="audit-actor">{{ entry.actor }}</span>
          <span class="audit-action">{{ entry.action }}</span>
          <span class="risk-badge" :class="entry.riskLevel.toLowerCase()">{{ entry.riskLevel }}</span>
          <span class="audit-outcome" :class="entry.outcome">{{ entry.outcome }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OperationAction, PendingOperation, AuditEntry } from "../interfaces/operation.ts";

const props = withDefaults(
  defineProps<{
    serviceId: string;
    serviceName?: string;
    status?: string;
    allowedActions?: OperationAction[];
    pendingOperation?: PendingOperation | null;
    auditLog?: AuditEntry[];
    isLoading?: boolean;
    error?: string | null;
  }>(),
  {
    serviceName: "",
    status: "unknown",
    allowedActions: () => ["start", "stop", "restart"],
    pendingOperation: null,
    auditLog: () => [],
    isLoading: false,
    error: null,
  }
);

const emit = defineEmits<{
  (e: "requestAction", action: OperationAction, serviceId: string): void;
  (e: "confirmOperation", operationId: string, token: string): void;
  (e: "cancelOperation"): void;
}>();

function isActionAllowed(action: OperationAction): boolean {
  return props.allowedActions.includes(action);
}

function formatTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString();
  } catch {
    return isoStr;
  }
}
</script>

<style scoped>
.service-operations {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #18191f;
  border: 1px solid #2d3139;
  border-radius: 6px;
}

.actions-bar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.btn {
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  border: none;
}

.btn-action {
  background: #2b313a;
  color: #f3f4f6;
}

.btn-action:hover {
  background: #3b4252;
}

.btn-stop {
  background: #4c1d24;
  color: #fca5a5;
}

.btn-stop:hover {
  background: #5f242c;
}

.confirmation-dialog {
  background: #23272e;
  border: 1px solid #f59e0b;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.confirmation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.warning-title {
  color: #f59e0b;
  font-weight: 600;
}

.risk-badge {
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
}

.risk-badge.l2 {
  background: #78350f;
  color: #fde68a;
  border: 1px solid #b45309;
}

.risk-badge.l3 {
  background: #7f1d1d;
  color: #fecaca;
  border: 1px solid #dc2626;
}

.confirmation-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.btn-confirm {
  background: #dc2626;
  color: #ffffff;
}

.btn-cancel {
  background: #374151;
  color: #e5e7eb;
}

.audit-trail {
  margin-top: 1rem;
}

.audit-list {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0 0;
}

.audit-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid #282c34;
  font-size: 0.85rem;
}

.audit-time {
  color: #9ca3af;
  font-family: monospace;
}

.audit-outcome.success {
  color: #34d399;
}

.audit-outcome.rejected {
  color: #f87171;
}
</style>
