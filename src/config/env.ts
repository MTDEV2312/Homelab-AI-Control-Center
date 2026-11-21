import { DockerEngineAdapter } from "../adapters/dockerEngineAdapter.ts";
import { SqliteRepository } from "../adapters/sqliteRepository.ts";
import type { AppOptions } from "../app.ts";

function isConfiguredValue(val?: string): val is string {
  if (!val) return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (/^your_.*_here$/i.test(trimmed)) return false;
  return true;
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
    const parsedTimeout = Number(env.DOCKER_TIMEOUT_MS);
    const timeoutMs = !Number.isNaN(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 5000;
    options.dockerClient = new DockerEngineAdapter({
      baseUrl: dockerHost,
      socketPath: dockerSocket,
      timeoutMs,
    });
  }

  return options;
}
