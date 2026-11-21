import { DockerEngineAdapter } from "../adapters/dockerEngineAdapter.ts";
import { SqliteRepository } from "../adapters/sqliteRepository.ts";
import { UptimeKumaAdapter } from "../adapters/uptimeKumaAdapter.ts";
import type { AppOptions } from "../app.ts";

function isConfiguredValue(val?: string): val is string {
  if (!val) return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (/^your_.*_here$/i.test(trimmed)) return false;
  return true;
}

function parseTimeoutMs(raw?: string, fallback = 5000): number {
  const parsed = Number(raw);
  return !Number.isNaN(parsed) && parsed > 0 ? parsed : fallback;
}

export function createAdaptersFromEnv(env: NodeJS.ProcessEnv = process.env): AppOptions {
  const options: AppOptions = {};

  const sqliteDbPath = isConfiguredValue(env.SQLITE_DB_PATH)
    ? env.SQLITE_DB_PATH.trim()
    : undefined;
  if (sqliteDbPath) {
    options.repository = new SqliteRepository(sqliteDbPath);
  }

  const dockerHost = isConfiguredValue(env.DOCKER_HOST) ? env.DOCKER_HOST.trim() : undefined;
  const dockerSocket = isConfiguredValue(env.DOCKER_SOCKET_PATH)
    ? env.DOCKER_SOCKET_PATH.trim()
    : undefined;

  if (dockerHost || dockerSocket) {
    options.dockerClient = new DockerEngineAdapter({
      baseUrl: dockerHost,
      socketPath: dockerSocket,
      timeoutMs: parseTimeoutMs(env.DOCKER_TIMEOUT_MS),
    });
  }

  const uptimeKumaUrl = isConfiguredValue(env.UPTIME_KUMA_URL)
    ? env.UPTIME_KUMA_URL.trim()
    : undefined;
  const uptimeKumaSlug = isConfiguredValue(env.UPTIME_KUMA_SLUG)
    ? env.UPTIME_KUMA_SLUG.trim()
    : undefined;

  if (uptimeKumaUrl && uptimeKumaSlug) {
    options.uptimeKumaClient = new UptimeKumaAdapter({
      baseUrl: uptimeKumaUrl,
      slug: uptimeKumaSlug,
      timeoutMs: parseTimeoutMs(env.UPTIME_KUMA_TIMEOUT_MS),
    });
  }

  return options;
}
