import type { OperationAction } from "./operation.ts";

export type ServiceStatus = "running" | "stopped" | "unhealthy" | "unknown";
export type IntegrationHealth = "available" | "unavailable";

export type HealthStatus = "healthy" | "unhealthy";

export interface HealthCheckResult {
  id: string;
  serviceId: string;
  status: HealthStatus;
  latencyMs: number;
  checkedAt: string;
  errorCode?: string;
}

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

export interface LogFilterOptions {
  query?: string;
  level?: LogLevel;
  since?: string;
  limit?: number;
}

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
  getContainerLogs?(containerId: string, options?: LogFilterOptions): Promise<LogEntry[]>;
  checkHealth?(containerId: string): Promise<{ status: HealthStatus; latencyMs: number; errorCode?: string }>;
  executeContainerAction?(containerId: string, action: string): Promise<void>;
}

export interface Service {
  id: string;
  name: string;
  externalId: string;
  integration: string;
  allowedActions?: OperationAction[];
  createdAt: string;
}
