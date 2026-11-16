import type { IntegrationHealth } from "./service.ts";

export type MonitorStatus = "up" | "down" | "pending" | "maintenance";

export interface UptimeKumaHeartbeat {
  status: MonitorStatus;
  timestamp: string;
  latencyMs: number;
  message?: string;
}

export interface UptimeKumaMonitor {
  id: string;
  name: string;
  url?: string;
  status: MonitorStatus;
  uptimePercent: number;
  latencyMs: number;
  heartbeats: UptimeKumaHeartbeat[];
  serviceId?: string;
}

export interface UptimeKumaClient {
  getMonitors(): Promise<Omit<UptimeKumaMonitor, "serviceId">[]>;
}

export interface UptimeKumaMonitorsResult {
  integrationStatus: IntegrationHealth;
  monitors: UptimeKumaMonitor[];
}
