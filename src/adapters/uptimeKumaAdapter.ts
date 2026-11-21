import type {
  UptimeKumaClient,
  UptimeKumaHeartbeat,
  UptimeKumaMonitor,
} from "../interfaces/uptimeKuma.ts";

export interface UptimeKumaAdapterOptions {
  baseUrl: string;
  slug: string;
  timeoutMs?: number;
}

interface StatusPageResponse {
  publicGroupList?: Array<{
    monitorList?: Array<{ id: number | string; name: string; url?: string }>;
  }>;
}

interface HeartbeatResponse {
  heartbeatList?: Record<string, Array<{ time: string; msg?: string; ping?: number }>>;
  uptimeList?: Record<string, number>;
}

/** HTTP adapter reading monitor status and heartbeats from Uptime Kuma's status page API. */
export class UptimeKumaAdapter implements UptimeKumaClient {
  private baseUrl: string;
  private slug: string;

  constructor(options: UptimeKumaAdapterOptions) {
    this.baseUrl = options.baseUrl.trim().replace(/\/+$/, "");
    this.slug = options.slug.trim();
  }

  async getMonitors(): Promise<Omit<UptimeKumaMonitor, "serviceId">[]> {
    const encodedSlug = encodeURIComponent(this.slug);
    const [statusRes, heartbeatRes] = await Promise.all([
      fetch(`${this.baseUrl}/api/status-page/${encodedSlug}`),
      fetch(`${this.baseUrl}/api/status-page/heartbeat/${encodedSlug}`),
    ]);

    const statusData = (await statusRes.json()) as StatusPageResponse;
    const heartbeatData = (await heartbeatRes.json()) as HeartbeatResponse;

    const monitors = (statusData.publicGroupList ?? []).flatMap(
      (group) => group.monitorList ?? []
    );

    return monitors.map((monitor) => {
      const id = String(monitor.id);
      const heartbeats: UptimeKumaHeartbeat[] = (
        heartbeatData.heartbeatList?.[id] ?? []
      ).map((hb) => ({
        status: "up",
        timestamp: hb.time,
        latencyMs: hb.ping ?? 0,
        ...(hb.msg ? { message: hb.msg } : {}),
      }));
      const latest = heartbeats[heartbeats.length - 1];
      const uptimeRatio = heartbeatData.uptimeList?.[`${id}_24`] ?? 0;

      return {
        id,
        name: monitor.name,
        ...(monitor.url ? { url: monitor.url } : {}),
        status: latest?.status ?? "up",
        uptimePercent: Math.round(uptimeRatio * 10000) / 100,
        latencyMs: latest?.latencyMs ?? 0,
        heartbeats,
      };
    });
  }
}
