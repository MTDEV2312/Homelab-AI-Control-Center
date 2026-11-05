<template>
  <div class="ai-assistant">
    <div class="assistant-header">
      <h4>AI Assistant Diagnosis</h4>
      <span v-if="serviceName" class="context-pill">Context: {{ serviceName }}</span>
    </div>

    <form class="assistant-form" @submit.prevent="handleSubmit">
      <input
        v-model="query"
        name="query"
        placeholder="Ask the AI assistant to investigate an issue..."
        :disabled="isLoading"
        required
      />
      <button type="submit" :disabled="isLoading">
        {{ isLoading ? "Diagnosing..." : "Investigate" }}
      </button>
    </form>

    <div v-if="error" class="banner error">
      {{ error }}
    </div>

    <div v-if="diagnosticResponse" class="diagnostic-results">
      <!-- Tool Execution Traces -->
      <section v-if="diagnosticResponse.toolTraces?.length" class="tool-trace">
        <h5>Direct Tool Outputs (Evidence Gathering)</h5>
        <div
          v-for="(trace, index) in diagnosticResponse.toolTraces"
          :key="index"
          class="tool-trace-item"
        >
          <span class="tool-name">{{ trace.tool }}</span>
          <pre v-if="trace.result" class="trace-output">{{ JSON.stringify(trace.result, null, 2) }}</pre>
          <div v-if="trace.error" class="trace-error">{{ trace.error }}</div>
        </div>
      </section>

      <!-- Structured Diagnosis -->
      <section v-if="diagnosticResponse.diagnosis" class="structured-diagnosis">
        <div class="diagnosis-facts">
          <strong>Facts:</strong>
          <ul>
            <li v-for="(fact, i) in diagnosticResponse.diagnosis.facts" :key="i">{{ fact }}</li>
          </ul>
        </div>

        <div class="diagnosis-hypotheses">
          <strong>Hypotheses:</strong>
          <ul>
            <li v-for="(hyp, i) in diagnosticResponse.diagnosis.hypotheses" :key="i">{{ hyp }}</li>
          </ul>
        </div>

        <div class="diagnosis-evidence">
          <strong>Evidence:</strong>
          <ul>
            <li v-for="(evi, i) in diagnosticResponse.diagnosis.evidence" :key="i">{{ evi }}</li>
          </ul>
        </div>

        <div class="diagnosis-recommendations">
          <strong>Recommendations:</strong>
          <ul>
            <li v-for="(rec, i) in diagnosticResponse.diagnosis.recommendations" :key="i">{{ rec }}</li>
          </ul>
        </div>
      </section>

      <!-- Proposed Recovery Action Banner -->
      <section
        v-if="diagnosticResponse.proposedOperation"
        class="proposed-operation-banner"
      >
        <div class="proposal-header">
          <span class="proposal-title">AI Suggested Recovery Action</span>
          <span
            class="risk-badge"
            :class="diagnosticResponse.proposedOperation.riskLevel.toLowerCase()"
          >
            {{ diagnosticResponse.proposedOperation.riskLevel }}
          </span>
        </div>
        <p class="proposal-desc">
          The assistant recommends to <strong>{{ diagnosticResponse.proposedOperation.action }}</strong> service
          <em>{{ serviceName || serviceId }}</em>. Explicit human confirmation is required.
        </p>
        <button
          type="button"
          class="btn-confirm-proposal"
          :disabled="isLoading"
          @click="
            emit(
              'confirmOperation',
              diagnosticResponse.proposedOperation.id,
              diagnosticResponse.proposedOperation.confirmationToken
            )
          "
        >
          Confirm & Execute {{ diagnosticResponse.proposedOperation.action }}
        </button>
      </section>

      <!-- Proposal Rejection Warning -->
      <div
        v-if="diagnosticResponse.proposalRejectionReason"
        class="banner warning proposal-rejection"
      >
        <strong>Proposal Blocked:</strong> {{ diagnosticResponse.proposalRejectionReason }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { DiagnosticResponse } from "../interfaces/assistant.ts";

const props = defineProps<{
  serviceId?: string;
  serviceName?: string;
  diagnosticResponse?: DiagnosticResponse | null;
  isLoading?: boolean;
  error?: string | null;
}>();

const emit = defineEmits<{
  (e: "ask", query: string, serviceId?: string): void;
  (e: "confirmOperation", operationId: string, token: string): void;
}>();

const query = ref("");

function handleSubmit() {
  if (!query.value.trim()) return;
  emit("ask", query.value.trim(), props.serviceId);
}
</script>

<style scoped>
.ai-assistant {
  margin-top: 1.5rem;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 1rem;
}
.assistant-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}
.context-pill {
  font-size: 0.8rem;
  background: #1e293b;
  color: #94a3b8;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}
.assistant-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.tool-trace {
  background: #1e293b;
  border-left: 3px solid #3b82f6;
  border-radius: 4px;
  padding: 0.75rem;
  margin-bottom: 1rem;
}
.tool-trace-item {
  margin-top: 0.5rem;
}
.tool-name {
  font-family: monospace;
  font-weight: bold;
  color: #60a5fa;
}
.trace-output {
  font-size: 0.8rem;
  background: #020617;
  padding: 0.5rem;
  border-radius: 4px;
  max-height: 150px;
  overflow-y: auto;
}
.trace-error {
  color: #fca5a5;
  font-size: 0.85rem;
}
.structured-diagnosis {
  display: grid;
  gap: 0.75rem;
}
.structured-diagnosis > div {
  background: #1e293b;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid #334155;
}
.diagnosis-facts {
  border-left: 3px solid #10b981 !important;
}
.diagnosis-hypotheses {
  border-left: 3px solid #f59e0b !important;
}
.diagnosis-evidence {
  border-left: 3px solid #8b5cf6 !important;
}
.diagnosis-recommendations {
  border-left: 3px solid #06b6d4 !important;
}
ul {
  margin: 0.3rem 0 0 1.2rem;
  padding: 0;
}
li {
  font-size: 0.9rem;
  line-height: 1.4;
}
.proposed-operation-banner {
  margin-top: 1rem;
  background: #1e1b4b;
  border: 1px solid #6366f1;
  border-radius: 6px;
  padding: 0.85rem;
}
.proposal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
}
.proposal-title {
  color: #a5b4fc;
  font-weight: 600;
  font-size: 0.9rem;
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
.proposal-desc {
  font-size: 0.85rem;
  color: #e0e7ff;
  margin-bottom: 0.75rem;
}
.btn-confirm-proposal {
  background: #4f46e5;
  color: #ffffff;
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
}
.btn-confirm-proposal:hover {
  background: #4338ca;
}
.proposal-rejection {
  margin-top: 0.75rem;
  padding: 0.5rem;
  background: #451a03;
  border-left: 3px solid #f59e0b;
  color: #fef3c7;
  font-size: 0.85rem;
  border-radius: 4px;
}
</style>
