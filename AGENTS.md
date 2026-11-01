# Homelab AI Control Center

## Context
Unified web control center and AI-ready operations layer for homelab administrators to monitor services, inspect logs, diagnose issues with evidence, and execute audited recovery actions without replacing underlying tools.

Stack: Nuxt 3, Fastify (Node.js), TypeScript, SQLite + Drizzle ORM, Zod, REST + SSE, ECharts, Ollama (or compatible LLM API), WebMCP + MCP SDK, Vitest, Docker Compose.

Expensive decisions: Permissions and roles model (risk levels L0–L3, user vs. agent authorization, explicit confirmation for write operations).
