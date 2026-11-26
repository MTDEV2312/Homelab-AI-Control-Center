# Homelab AI Control Center

## Context
Unified web control center and AI-ready operations layer for homelab administrators to monitor services, inspect logs, diagnose issues with evidence, and execute audited recovery actions without replacing underlying tools.

Stack: Vue 3 + Vite (Nuxt 3 target), Fastify (Node.js 24), TypeScript, SQLite (native `node:sqlite`), Zod, REST + SSE, ECharts, Ollama / OpenAI-compatible LLM API, WebMCP + MCP, Vitest, Docker Compose.

Expensive decisions: Permissions and roles model (risk levels L0–L3, user vs. agent authorization, explicit confirmation for write operations; Uptime Kuma and n8n adapters stay read-only L0).

## Architecture Decisions
- **Storage**: Native `node:sqlite` (`DatabaseSync`, WAL mode, `PRAGMA user_version` migrations) behind `ControlCenterRepository`; falls back to in-memory when `SQLITE_DB_PATH` is unset.
- **Adapters**: Zero-extra-dependency HTTP/`fetch` adapters wired in `src/config/env.ts` (ignoring `your_*_here` placeholders), degrading integrations to `unavailable` on error or timeout.
- **LLM Provider**: OpenAI-compatible `/v1/chat/completions` adapter (optional API key) supporting Ollama, LM Studio, vLLM, and cloud APIs with structured JSON output.
- **Runtime**: Node.js 24 `--experimental-strip-types` — use explicit class fields instead of TypeScript constructor parameter properties.
