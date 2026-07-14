import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { signToken } from "@buildsphere/service-core";
import { createMonitoringApp } from "./app.js";
import { StaticHealthChecker } from "./health-checker.js";

test("health aggregation reports degraded services and exposes Prometheus metrics", async () => {
  const secret = "monitoring-test-secret";
  const token = signToken(
    { userId: "user-1", email: "user@example.com", role: "user" },
    secret,
    "access",
    "15m",
  );
  const checker = new StaticHealthChecker({
    status: "degraded",
    checkedAt: new Date().toISOString(),
    services: [
      {
        service: "auth-service",
        status: "ok",
        timestamp: new Date().toISOString(),
        responseTimeMs: 5,
      },
      {
        service: "project-service",
        status: "unavailable",
        timestamp: new Date().toISOString(),
        responseTimeMs: 3_000,
      },
    ],
  });
  const server = createMonitoringApp(checker, secret).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const health = await fetch(`${baseUrl}/monitoring/health`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(health.status, 200);
    assert.equal(
      ((await health.json()) as { data: { status: string } }).data.status,
      "degraded",
    );
    const metrics = await (await fetch(`${baseUrl}/metrics`)).text();
    assert.match(
      metrics,
      /buildsphere_service_up\{service="project-service"\} 0/,
    );
    assert.match(metrics, /buildsphere_http_requests_total/);
    assert.match(metrics, /service="monitoring-service"/);
  } finally {
    server.close();
  }
});
