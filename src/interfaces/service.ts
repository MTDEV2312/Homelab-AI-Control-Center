export type ServiceStatus = "running" | "stopped" | "unhealthy" | "unknown";
export type IntegrationHealth = "available" | "unavailable";

export interface ContainerMetrics {
  available: boolean;
  reason?: string;
  cpuPercent?: number;
  memoryUsedBytes?: number;
  memoryLimitBytes?: number;
  uptimeSeconds?: number;
}

export interface DockerClient {
  getContainerStatus(containerId: string): Promise<ServiceStatus>;
  getContainerMetrics?(containerId: string): Promise<Omit<ContainerMetrics, "available">>;
}

export interface Service {
  id: string;
  name: string;
  externalId: string;
  integration: string;
  createdAt: string;
}
