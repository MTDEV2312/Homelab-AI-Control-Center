import type { ServiceManager } from "./serviceManager.ts";
import type { ControlCenterRepository } from "../interfaces/repository.ts";
import type {
  UptimeKumaClient,
  UptimeKumaMonitor,
  UptimeKumaMonitorsResult,
} from "../interfaces/uptimeKuma.ts";

export class UptimeKumaService {
  private client?: UptimeKumaClient;
  private serviceManager?: ServiceManager;
  private repository?: ControlCenterRepository;
  private links: Map<string, string> = new Map();

  constructor(
    options: {
      client?: UptimeKumaClient;
      serviceManager?: ServiceManager;
      repository?: ControlCenterRepository;
    } = {}
  ) {
    this.client = options.client;
    this.serviceManager = options.serviceManager;
    this.repository = options.repository;
  }

  private getLinksMap(): Map<string, string> {
    return this.repository ? this.repository.getMonitorLinks() : this.links;
  }

  hasClient(): boolean {
    return Boolean(this.client);
  }

  async listMonitors(): Promise<UptimeKumaMonitorsResult> {
    if (!this.client) {
      return {
        integrationStatus: "available",
        monitors: [],
      };
    }

    try {
      const links = this.getLinksMap();
      const rawMonitors = await this.client.getMonitors();
      const monitors: UptimeKumaMonitor[] = rawMonitors.map((m) => ({
        ...m,
        ...(links.has(m.id) ? { serviceId: links.get(m.id) } : {}),
      }));

      return {
        integrationStatus: "available",
        monitors,
      };
    } catch {
      return {
        integrationStatus: "unavailable",
        monitors: [],
      };
    }
  }

  async linkMonitor(monitorId: string, serviceId: string): Promise<UptimeKumaMonitor | null> {
    if (this.serviceManager) {
      const srv = await this.serviceManager.getById(serviceId);
      if (!srv) {
        return null;
      }
    }

    const { monitors } = await this.listMonitors();
    const target = monitors.find((m) => m.id === monitorId);
    if (!target) {
      return null;
    }

    if (this.repository) {
      this.repository.setMonitorLink(monitorId, serviceId);
    } else {
      for (const [mId, sId] of this.links.entries()) {
        if (sId === serviceId) {
          this.links.delete(mId);
        }
      }
      this.links.set(monitorId, serviceId);
    }

    return {
      ...target,
      serviceId,
    };
  }

  async getMonitorForService(serviceId: string): Promise<UptimeKumaMonitor | undefined> {
    const { monitors } = await this.listMonitors();
    return monitors.find((m) => m.serviceId === serviceId);
  }
}
