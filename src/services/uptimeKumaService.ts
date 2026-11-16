import type {
  UptimeKumaClient,
  UptimeKumaMonitor,
  UptimeKumaMonitorsResult,
} from "../interfaces/uptimeKuma.ts";

export class UptimeKumaService {
  private client?: UptimeKumaClient;

  constructor(options: { client?: UptimeKumaClient } = {}) {
    this.client = options.client;
  }

  async listMonitors(): Promise<UptimeKumaMonitorsResult> {
    if (!this.client) {
      return {
        integrationStatus: "available",
        monitors: [],
      };
    }

    const rawMonitors = await this.client.getMonitors();
    const monitors: UptimeKumaMonitor[] = rawMonitors.map((m) => ({
      ...m,
    }));

    return {
      integrationStatus: "available",
      monitors,
    };
  }
}
