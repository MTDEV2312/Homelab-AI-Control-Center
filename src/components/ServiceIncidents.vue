<template>
  <div class="service-incidents">
    <div class="incidents-header">
      <h4>Service Incidents</h4>
    </div>

    <!-- Create Incident Form -->
    <div class="create-incident-section">
      <h5>Report / Track New Incident</h5>
      <div class="form-grid">
        <div class="form-group">
          <label>Title</label>
          <input
            v-model="newTitle"
            data-field="title"
            placeholder="e.g. Memory spike, 502 errors"
            class="input-field"
          />
        </div>
        <div class="form-group">
          <label>Severity</label>
          <select v-model="newSeverity" data-field="severity" class="select-field">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Description</label>
        <textarea
          v-model="newDescription"
          data-field="description"
          placeholder="What symptoms or failures were observed?"
          class="input-field textarea-field"
        ></textarea>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label>Hypotheses (comma separated)</label>
          <input
            v-model="newHypotheses"
            data-field="hypotheses"
            placeholder="e.g. Memory leak, DNS timeout"
            class="input-field"
          />
        </div>
        <div class="form-group">
          <label>Evidence (comma separated)</label>
          <input
            v-model="newEvidence"
            data-field="evidence"
            placeholder="e.g. OOM killer in dmesg, 502 in proxy log"
            class="input-field"
          />
        </div>
      </div>

      <button
        type="button"
        data-action="create-incident"
        class="btn btn-primary"
        :disabled="!newTitle.trim()"
        @click="handleCreate"
      >
        Track Incident
      </button>
    </div>

    <!-- Incidents List -->
    <div class="incidents-list">
      <h5>Active & Historical Incidents</h5>
      <div v-if="incidents.length === 0" class="empty-state">
        No incidents recorded for this service.
      </div>
      <div
        v-for="inc in incidents"
        :key="inc.id"
        :data-incident-id="inc.id"
        class="incident-card"
        :class="inc.status"
      >
        <div class="card-header">
          <div class="header-left">
            <span class="incident-title">{{ inc.title }}</span>
            <span class="badge severity-badge" :class="inc.severity">{{ inc.severity }}</span>
            <span class="badge status-badge" :class="inc.status">{{ inc.status }}</span>
          </div>
          <div class="header-right">
            <span class="incident-time">{{ formatTime(inc.startedAt) }}</span>
            <span v-if="inc.resolvedAt" class="resolved-time">
              (Resolved: {{ formatTime(inc.resolvedAt) }})
            </span>
          </div>
        </div>

        <p v-if="inc.description" class="incident-desc">{{ inc.description }}</p>

        <!-- Hypotheses Section -->
        <div v-if="inc.hypotheses && inc.hypotheses.length > 0" class="incident-section incident-hypotheses">
          <strong>Hypotheses:</strong>
          <ul>
            <li v-for="(h, idx) in inc.hypotheses" :key="idx">{{ h }}</li>
          </ul>
        </div>

        <!-- Evidence Section -->
        <div v-if="inc.evidence && inc.evidence.length > 0" class="incident-section incident-evidence">
          <strong>Evidence:</strong>
          <ul>
            <li v-for="(e, idx) in inc.evidence" :key="idx">{{ e }}</li>
          </ul>
        </div>

        <!-- Actions Section -->
        <div v-if="inc.actions && inc.actions.length > 0" class="incident-section incident-actions">
          <strong>Actions Executed:</strong>
          <ul>
            <li v-for="(a, idx) in inc.actions" :key="idx">{{ a }}</li>
          </ul>
        </div>

        <!-- Confirmed Cause Section (Strictly Separated from Hypotheses) -->
        <div v-if="inc.confirmedCause || inc.resolutionNotes" class="incident-section incident-confirmed-cause">
          <div class="confirmed-cause-box">
            <span class="cause-label">Confirmed Root Cause:</span>
            <p v-if="inc.confirmedCause" class="cause-text">{{ inc.confirmedCause }}</p>
            <p v-if="inc.resolutionNotes" class="resolution-notes">{{ inc.resolutionNotes }}</p>
          </div>
        </div>

        <!-- Incident Actions / Lifecycle Controls -->
        <div v-if="inc.status !== 'resolved'" class="card-controls">
          <div class="resolve-inputs">
            <input
              v-model="resolveCause[inc.id]"
              data-field="confirmedCause"
              placeholder="Confirmed root cause"
              class="input-field input-sm"
            />
            <input
              v-model="resolveNotes[inc.id]"
              data-field="resolutionNotes"
              placeholder="Resolution notes"
              class="input-field input-sm"
            />
          </div>
          <div class="control-buttons">
            <button
              v-if="inc.status === 'open'"
              type="button"
              data-action="investigate"
              class="btn btn-secondary btn-sm"
              @click="handleUpdateStatus(inc.id, 'investigating')"
            >
              Investigate
            </button>
            <button
              v-if="inc.status === 'investigating'"
              type="button"
              data-action="mitigate"
              class="btn btn-secondary btn-sm"
              @click="handleUpdateStatus(inc.id, 'mitigated')"
            >
              Mitigate
            </button>
            <button
              type="button"
              data-action="resolve"
              class="btn btn-resolve btn-sm"
              @click="handleResolve(inc.id)"
            >
              Resolve
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type {
  Incident,
  IncidentSeverity,
  IncidentStatus,
  CreateIncidentInput,
  UpdateIncidentInput,
} from "../interfaces/incident.ts";

const props = withDefaults(
  defineProps<{
    serviceId: string;
    incidents?: Incident[];
  }>(),
  {
    incidents: () => [],
  }
);

const emit = defineEmits<{
  (e: "createIncident", input: CreateIncidentInput): void;
  (e: "updateIncident", id: string, input: UpdateIncidentInput): void;
}>();

const newTitle = ref("");
const newDescription = ref("");
const newSeverity = ref<IncidentSeverity>("medium");
const newHypotheses = ref("");
const newEvidence = ref("");

const resolveCause = ref<Record<string, string>>({});
const resolveNotes = ref<Record<string, string>>({});

function handleCreate() {
  if (!newTitle.value.trim()) return;

  const hypothesesList = newHypotheses.value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const evidenceList = newEvidence.value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  emit("createIncident", {
    serviceId: props.serviceId,
    title: newTitle.value.trim(),
    description: newDescription.value.trim() || undefined,
    severity: newSeverity.value,
    hypotheses: hypothesesList.length > 0 ? hypothesesList : undefined,
    evidence: evidenceList.length > 0 ? evidenceList : undefined,
  });

  newTitle.value = "";
  newDescription.value = "";
  newSeverity.value = "medium";
  newHypotheses.value = "";
  newEvidence.value = "";
}

function handleUpdateStatus(id: string, status: IncidentStatus) {
  emit("updateIncident", id, { status });
}

function handleResolve(id: string) {
  const confirmedCause = resolveCause.value[id]?.trim() || undefined;
  const resolutionNotes = resolveNotes.value[id]?.trim() || undefined;

  emit("updateIncident", id, {
    status: "resolved",
    confirmedCause,
    resolutionNotes,
  });
}

function formatTime(isoStr?: string): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return d.toLocaleString();
  } catch {
    return isoStr;
  }
}
</script>

<style scoped>
.service-incidents {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #18191f;
  border: 1px solid #2d3139;
  border-radius: 6px;
}

.incidents-header h4 {
  margin: 0 0 1rem 0;
  color: #f3f4f6;
}

.create-incident-section {
  background: #23272e;
  border: 1px solid #374151;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.create-incident-section h5,
.incidents-list h5 {
  margin: 0 0 0.75rem 0;
  color: #e5e7eb;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.form-group label {
  font-size: 0.8rem;
  color: #9ca3af;
}

.input-field,
.select-field {
  padding: 0.45rem 0.6rem;
  background: #1e222b;
  border: 1px solid #4b5563;
  border-radius: 4px;
  color: #f3f4f6;
  font-size: 0.85rem;
}

.textarea-field {
  min-height: 50px;
  resize: vertical;
}

.btn {
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  border: none;
}

.btn-primary {
  background: #2563eb;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #374151;
  color: #e5e7eb;
}

.btn-resolve {
  background: #059669;
  color: #ffffff;
}

.btn-resolve:hover {
  background: #047857;
}

.btn-sm {
  font-size: 0.8rem;
  padding: 0.3rem 0.6rem;
}

.incidents-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty-state {
  color: #9ca3af;
  font-size: 0.85rem;
}

.incident-card {
  background: #20242c;
  border: 1px solid #374151;
  border-radius: 6px;
  padding: 1rem;
}

.incident-card.open {
  border-left: 4px solid #ef4444;
}

.incident-card.investigating {
  border-left: 4px solid #f59e0b;
}

.incident-card.mitigated {
  border-left: 4px solid #3b82f6;
}

.incident-card.resolved {
  border-left: 4px solid #10b981;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.incident-title {
  font-weight: 600;
  color: #f9fafb;
}

.header-right {
  font-size: 0.8rem;
  color: #9ca3af;
}

.resolved-time {
  color: #34d399;
  margin-left: 0.5rem;
}

.badge {
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.severity-badge.low {
  background: #1f2937;
  color: #9ca3af;
}
.severity-badge.medium {
  background: #78350f;
  color: #fde68a;
}
.severity-badge.high {
  background: #9a3412;
  color: #fed7aa;
}
.severity-badge.critical {
  background: #7f1d1d;
  color: #fecaca;
}

.status-badge.open {
  background: #7f1d1d;
  color: #fecaca;
}
.status-badge.investigating {
  background: #78350f;
  color: #fde68a;
}
.status-badge.mitigated {
  background: #1e3a8a;
  color: #bfdbfe;
}
.status-badge.resolved {
  background: #064e3b;
  color: #a7f3d0;
}

.incident-desc {
  color: #d1d5db;
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.incident-section {
  margin-top: 0.5rem;
  font-size: 0.85rem;
}

.incident-section strong {
  color: #9ca3af;
}

.incident-section ul {
  margin: 0.25rem 0 0 1.25rem;
  padding: 0;
  color: #e5e7eb;
}

.incident-confirmed-cause {
  margin-top: 0.75rem;
}

.confirmed-cause-box {
  background: #132a22;
  border: 1px solid #059669;
  border-radius: 4px;
  padding: 0.6rem;
}

.cause-label {
  font-weight: 700;
  color: #34d399;
  font-size: 0.8rem;
  display: block;
  margin-bottom: 0.25rem;
}

.cause-text {
  color: #f3f4f6;
  margin: 0 0 0.25rem 0;
}

.resolution-notes {
  color: #a7f3d0;
  margin: 0;
  font-style: italic;
  font-size: 0.8rem;
}

.card-controls {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #2d3139;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.resolve-inputs {
  display: flex;
  gap: 0.5rem;
}

.input-sm {
  flex: 1;
  font-size: 0.8rem;
  padding: 0.35rem 0.5rem;
}

.control-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
