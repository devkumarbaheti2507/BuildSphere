import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { dump, loadAll } from "js-yaml";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const chart = path.join(repoRoot, "infrastructure", "helm", "buildsphere");
const helm = process.env.HELM_BIN?.trim() || "helm";

const runHelm = (args, expectSuccess = true) => {
  const result = spawnSync(helm, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(
      `Unable to run Helm (${helm}). Install Helm or set HELM_BIN: ${result.error.message}`,
    );
  }
  if (expectSuccess && result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Helm command failed");
  }
  if (!expectSuccess && result.status === 0) {
    throw new Error(`Expected Helm command to fail: helm ${args.join(" ")}`);
  }
  return result.stdout;
};

const render = (...args) =>
  loadAll(
    runHelm([
      "template",
      "buildsphere",
      chart,
      "--namespace",
      "buildsphere",
      ...args,
    ]),
  ).filter((document) => document && typeof document === "object");

const byKind = (documents, kind) =>
  documents.filter((document) => document.kind === kind);
const component = (resource) =>
  resource.metadata?.labels?.["app.kubernetes.io/component"];

const backendServices = [
  "ai-service",
  "analytics-service",
  "api-gateway",
  "auth-service",
  "deployment-service",
  "logging-service",
  "monitoring-service",
  "notification-service",
  "pipeline-service",
  "project-service",
];

runHelm(["lint", "--strict", chart]);

const defaults = render();
assert.equal(byKind(defaults, "ServiceMonitor").length, 0);
assert.equal(byKind(defaults, "PrometheusRule").length, 0);
assert.equal(byKind(defaults, "Secret").length, 0);

const services = byKind(defaults, "Service");
for (const serviceName of backendServices) {
  const service = services.find(
    (candidate) => component(candidate) === serviceName,
  );
  assert.ok(service, `missing Service for ${serviceName}`);
  assert.equal(service.metadata.labels["buildsphere.io/metrics"], "true");
  assert.equal(service.metadata.annotations["prometheus.io/scrape"], "true");
  assert.equal(service.metadata.annotations["prometheus.io/path"], "/metrics");
  assert.equal(service.metadata.annotations["prometheus.io/scheme"], "http");
  assert.equal(
    service.metadata.annotations["prometheus.io/port"],
    String(service.spec.ports[0].port),
  );
}

const frontend = services.find((service) => component(service) === "frontend");
assert.ok(frontend);
assert.equal(frontend.metadata.labels["buildsphere.io/metrics"], undefined);
assert.equal(
  frontend.metadata.annotations?.["prometheus.io/scrape"],
  undefined,
);

const operatorDocuments = render(
  "--set",
  "observability.serviceMonitor.enabled=true",
  "--set-string",
  "observability.serviceMonitor.namespace=monitoring",
  "--set-string",
  "observability.serviceMonitor.additionalLabels.release=platform-monitoring",
  "--set",
  "observability.prometheusRule.enabled=true",
  "--set-string",
  "observability.prometheusRule.namespace=monitoring",
  "--set-string",
  "observability.prometheusRule.additionalLabels.release=platform-monitoring",
);

const serviceMonitor = byKind(operatorDocuments, "ServiceMonitor")[0];
assert.ok(serviceMonitor);
assert.equal(serviceMonitor.metadata.namespace, "monitoring");
assert.equal(serviceMonitor.metadata.labels.release, "platform-monitoring");
assert.deepEqual(serviceMonitor.spec.namespaceSelector.matchNames, [
  "buildsphere",
]);
assert.deepEqual(serviceMonitor.spec.selector.matchLabels, {
  "app.kubernetes.io/name": "buildsphere",
  "app.kubernetes.io/instance": "buildsphere",
  "buildsphere.io/metrics": "true",
});
assert.equal(serviceMonitor.spec.endpoints.length, 1);
assert.deepEqual(serviceMonitor.spec.endpoints[0], {
  port: "http",
  path: "/metrics",
  scheme: "http",
  honorLabels: true,
  interval: "30s",
  scrapeTimeout: "10s",
});

const prometheusRule = byKind(operatorDocuments, "PrometheusRule")[0];
assert.ok(prometheusRule);
assert.equal(prometheusRule.metadata.namespace, "monitoring");
assert.equal(prometheusRule.metadata.labels.release, "platform-monitoring");
assert.equal(prometheusRule.spec.groups.length, 2);

const rules = prometheusRule.spec.groups.flatMap((group) => group.rules);
const recordingRules = new Set(
  rules.filter((rule) => rule.record).map((rule) => rule.record),
);
const alertRules = rules.filter((rule) => rule.alert);
assert.deepEqual(
  recordingRules,
  new Set([
    "buildsphere:api_gateway_http_requests:rate5m",
    "buildsphere:api_gateway_http_server_error_ratio:rate5m",
    "buildsphere:api_gateway_http_server_error_ratio:rate30d",
    "buildsphere:api_gateway_http_availability:rate30d",
    "buildsphere:api_gateway_http_request_duration_seconds:p95_rate5m",
    "buildsphere:api_gateway_http_latency_sli:rate30d",
  ]),
);
assert.deepEqual(
  new Set(alertRules.map((rule) => rule.alert)),
  new Set([
    "BuildSphereServiceDown",
    "BuildSphereApiGatewayHighServerErrorRatio",
    "BuildSphereApiGatewayHighLatency",
  ]),
);

for (const rule of rules) {
  assert.equal(typeof rule.expr, "string");
  assert.doesNotMatch(rule.expr, /\\"/);
}
for (const alert of alertRules) {
  const runbook = alert.annotations?.runbook;
  assert.equal(typeof runbook, "string");
  assert.ok(existsSync(path.join(repoRoot, runbook)));
  assert.match(
    readFileSync(path.join(repoRoot, runbook), "utf8"),
    new RegExp(alert.alert),
  );
}

let promtoolValidated = false;
const promtool = process.env.PROMTOOL_BIN?.trim();
if (process.env.CI === "true" && !promtool) {
  throw new Error("PROMTOOL_BIN is required for Phase 11 verification in CI");
}
if (promtool) {
  const temporaryDirectory = mkdtempSync(
    path.join(tmpdir(), "buildsphere-promtool-"),
  );
  const rulesPath = path.join(temporaryDirectory, "buildsphere-rules.yaml");
  try {
    writeFileSync(
      rulesPath,
      dump({ groups: prometheusRule.spec.groups }, { lineWidth: -1 }),
    );
    const result = spawnSync(promtool, ["check", "rules", rulesPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    if (result.error || result.status !== 0) {
      throw new Error(
        result.error?.message ||
          result.stderr ||
          result.stdout ||
          "promtool rule validation failed",
      );
    }
    promtoolValidated = true;
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

const chartTest = byKind(defaults, "Pod").find(
  (pod) => component(pod) === "chart-test",
);
assert.ok(chartTest);
const chartTestScript = chartTest.spec.containers[0].args[0];
assert.equal((chartTestScript.match(/\/metrics/g) ?? []).length, 10);
assert.match(chartTestScript, /buildsphere_http_requests_total/);

const serviceCorePackage = JSON.parse(
  readFileSync(
    path.join(repoRoot, "packages", "service-core", "package.json"),
    "utf8",
  ),
);
assert.equal(serviceCorePackage.dependencies["prom-client"], "15.1.3");

for (const serviceName of backendServices) {
  const appSource = readFileSync(
    path.join(repoRoot, "backend", serviceName, "src", "app.ts"),
    "utf8",
  );
  assert.match(
    appSource,
    new RegExp(`installServiceObservability\\(app, "${serviceName}"`),
  );
  assert.doesNotMatch(appSource, /requestContext\(/);
}

const dashboardPath = path.join(
  repoRoot,
  "infrastructure",
  "observability",
  "grafana",
  "buildsphere-overview.json",
);
const dashboardSource = readFileSync(dashboardPath, "utf8");
const dashboard = JSON.parse(dashboardSource);
assert.equal(dashboard.uid, "buildsphere-overview");
assert.equal(dashboard.title, "BuildSphere Overview");
assert.ok(dashboard.panels.length >= 8);
assert.equal(
  new Set(dashboard.panels.map((panel) => panel.id)).size,
  dashboard.panels.length,
);
assert.match(dashboardSource, /\$\{DS_PROMETHEUS\}/);
assert.match(dashboardSource, /buildsphere_service_up/);
assert.match(dashboardSource, /buildsphere_http_requests_total/);
assert.match(
  dashboardSource,
  /buildsphere_http_request_duration_seconds_bucket/,
);
assert.match(dashboardSource, /buildsphere_process_resident_memory_bytes/);
assert.match(dashboardSource, /buildsphere_nodejs_eventloop_lag_seconds/);
assert.doesNotMatch(dashboardSource, /https?:\/\//);

for (let index = 0; index < dashboard.panels.length; index += 1) {
  const first = dashboard.panels[index].gridPos;
  assert.ok(first.w > 0 && first.h > 0);
  for (let other = index + 1; other < dashboard.panels.length; other += 1) {
    const second = dashboard.panels[other].gridPos;
    const overlaps =
      first.x < second.x + second.w &&
      first.x + first.w > second.x &&
      first.y < second.y + second.h &&
      first.y + first.h > second.y;
    assert.equal(
      overlaps,
      false,
      `dashboard panels ${dashboard.panels[index].id} and ${dashboard.panels[other].id} overlap`,
    );
  }
}

runHelm(
  [
    "template",
    "buildsphere",
    chart,
    "--set-string",
    "observability.serviceMonitor.interval=invalid",
  ],
  false,
);
runHelm(
  [
    "template",
    "buildsphere",
    chart,
    "--set",
    "observability.slo.latencyTargetSeconds=0.3",
  ],
  false,
);

console.log(
  JSON.stringify(
    {
      backendMetricsEndpoints: backendServices.length,
      defaultOperatorResources: 0,
      serviceMonitors: byKind(operatorDocuments, "ServiceMonitor").length,
      prometheusRules: byKind(operatorDocuments, "PrometheusRule").length,
      recordingRules: recordingRules.size,
      alertRules: alertRules.length,
      dashboardPanels: dashboard.panels.length,
      runbooks: alertRules.length,
      promtoolValidated,
    },
    null,
    2,
  ),
);
