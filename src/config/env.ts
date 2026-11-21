import { DockerEngineAdapter } from "../adapters/dockerEngineAdapter.ts";
import { N8nAdapter } from "../adapters/n8nAdapter.ts";
import { SqliteRepository } from "../adapters/sqliteRepository.ts";
import { UptimeKumaAdapter } from "../adapters/uptimeKumaAdapter.ts";
import type { AppOptions } from "../app.ts";

function getConfiguredValue(val?: string): string | undefined {
  if (!val) return undefined;
  const trimmed = val.trim();
  if (!trimmed || /^your_.*_here$/i.test(trimmed)) return undefined;
  return trimmed;
}

function parseTimeoutMs(raw?: string, fallback = 5000): number {
  const parsed = Number(raw);
  return !Number.isNaN(parsed) && parsed > 0 ? parsed : fallback;
}

export function createAdaptersFromEnv(env: NodeJS.ProcessEnv = process.env): AppOptions {
  const options: AppOptions = {};

  const sqliteDbPath = getConfiguredValue(env.SQLITE_DB_PATH);
  if (sqliteDbPath) {
    options.repository = new SqliteRepository(sqliteDbPath);
  }

  const dockerHost = getConfiguredValue(env.DOCKER_HOST);
  const dockerSocket = getConfiguredValue(env.DOCKER_SOCKET_PATH);

  if (dockerHost || dockerSocket) {
    options.dockerClient = new DockerEngineAdapter({
      baseUrl: dockerHost,
      socketPath: dockerSocket,
      timeoutMs: parseTimeoutMs(env.DOCKER_TIMEOUT_MS),
    });
  }

  const uptimeKumaUrl = getConfiguredValue(env.UPTIME_KUMA_URL);
  const uptimeKumaSlug = getConfiguredValue(env.UPTIME_KUMA_SLUG);

  if (uptimeKumaUrl && uptimeKumaSlug) {
    options.uptimeKumaClient = new UptimeKumaAdapter({
      baseUrl: uptimeKumaUrl,
      slug: uptimeKumaSlug,
      timeoutMs: parseTimeoutMs(env.UPTIME_KUMA_TIMEOUT_MS),
    });
  }

  const n8nUrl = getConfiguredValue(env.N8N_URL);
  const n8nApiKey = getConfiguredValue(env.N8N_API_KEY);

  if (n8nUrl && n8nApiKey) {
    options.n8nClient = new N8nAdapter({
      baseUrl: n8nUrl,
      apiKey: n8nApiKey,
      timeoutMs: parseTimeoutMs(env.N8N_TIMEOUT_MS),
    });
  }

  return options;
}
