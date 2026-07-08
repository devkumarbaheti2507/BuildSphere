import type { PlatformHealth, ServiceHealth } from "@buildsphere/shared-types";

export interface ServiceTarget {
  service: string;
  url: string;
}
export interface HealthChecker {
  check(): Promise<PlatformHealth>;
}

export class HttpHealthChecker implements HealthChecker {
  constructor(private readonly targets: ServiceTarget[]) {}
  async check(): Promise<PlatformHealth> {
    const services = await Promise.all(
      this.targets.map(async (target): Promise<ServiceHealth> => {
        const startedAt = performance.now();
        try {
          const response = await fetch(`${target.url}/health`, {
            signal: AbortSignal.timeout(3_000),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return {
            service: target.service,
            status: "ok",
            timestamp: new Date().toISOString(),
            responseTimeMs: Math.round(performance.now() - startedAt),
          };
        } catch {
          return {
            service: target.service,
            status: "unavailable",
            timestamp: new Date().toISOString(),
            responseTimeMs: Math.round(performance.now() - startedAt),
          };
        }
      }),
    );
    return {
      status: services.every((service) => service.status === "ok")
        ? "ok"
        : "degraded",
      services,
      checkedAt: new Date().toISOString(),
    };
  }
}

export class StaticHealthChecker implements HealthChecker {
  constructor(private readonly health: PlatformHealth) {}
  async check(): Promise<PlatformHealth> {
    return structuredClone(this.health);
  }
}

export const prometheusMetrics = (health: PlatformHealth): string => {
  const lines = [
    "# HELP buildsphere_service_up Whether a BuildSphere service health endpoint is reachable.",
    "# TYPE buildsphere_service_up gauge",
    ...health.services.map(
      (service) =>
        `buildsphere_service_up{service="${service.service}"} ${service.status === "ok" ? 1 : 0}`,
    ),
    "# HELP buildsphere_service_health_response_milliseconds Health endpoint response duration.",
    "# TYPE buildsphere_service_health_response_milliseconds gauge",
    ...health.services.map(
      (service) =>
        `buildsphere_service_health_response_milliseconds{service="${service.service}"} ${service.responseTimeMs ?? 0}`,
    ),
  ];
  return `${lines.join("\n")}\n`;
};
