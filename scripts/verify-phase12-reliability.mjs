import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadAll } from "js-yaml";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const chart = path.join(repoRoot, "infrastructure", "helm", "buildsphere");
const helm = process.env.HELM_BIN?.trim() || "helm";

const components = new Map([
  [
    "api-gateway",
    {
      port: 8080,
      callers: ["monitoring-service"],
      public: true,
      metrics: true,
    },
  ],
  [
    "auth-service",
    {
      port: 8081,
      callers: ["api-gateway", "project-service", "monitoring-service"],
      metrics: true,
    },
  ],
  [
    "project-service",
    {
      port: 8082,
      callers: ["api-gateway", "deployment-service", "monitoring-service"],
      metrics: true,
    },
  ],
  [
    "pipeline-service",
    {
      port: 8083,
      callers: ["api-gateway", "project-service", "monitoring-service"],
      metrics: true,
    },
  ],
  [
    "deployment-service",
    {
      port: 8084,
      callers: ["api-gateway", "monitoring-service"],
      metrics: true,
    },
  ],
  [
    "monitoring-service",
    { port: 8085, callers: ["api-gateway"], metrics: true },
  ],
  [
    "logging-service",
    {
      port: 8086,
      callers: ["api-gateway", "pipeline-service", "monitoring-service"],
      metrics: true,
    },
  ],
  [
    "ai-service",
    {
      port: 8087,
      callers: ["api-gateway", "project-service", "monitoring-service"],
      metrics: true,
    },
  ],
  ["analytics-service", { port: 8088, callers: [], metrics: true }],
  [
    "notification-service",
    {
      port: 8089,
      callers: [
        "api-gateway",
        "project-service",
        "pipeline-service",
        "deployment-service",
        "ai-service",
        "monitoring-service",
      ],
      metrics: true,
    },
  ],
  ["frontend", { port: 8080, callers: [], public: true, metrics: false }],
]);

const runHelm = (args, expectSuccess = true) => {
  const result = spawnSync(helm, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 24 * 1024 * 1024,
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
  return result;
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
    ]).stdout,
  ).filter((document) => document && typeof document === "object");

const byKind = (documents, kind) =>
  documents.filter((document) => document.kind === kind);
const component = (resource) =>
  resource.metadata?.labels?.["app.kubernetes.io/component"];
const keyedByComponent = (resources) =>
  new Map(resources.map((resource) => [component(resource), resource]));
const expectFailure = (args, pattern) => {
  const result = runHelm(["template", "buildsphere", chart, ...args], false);
  assert.match(`${result.stdout}\n${result.stderr}`, pattern);
};

runHelm(["lint", "--strict", chart]);

const defaults = render();
const defaultDeployments = keyedByComponent(byKind(defaults, "Deployment"));

assert.equal(defaults.length, 38, "default Phase 10 resource count changed");
assert.equal(byKind(defaults, "Secret").length, 0);
assert.equal(byKind(defaults, "PodDisruptionBudget").length, 0);
assert.equal(byKind(defaults, "HorizontalPodAutoscaler").length, 0);
assert.equal(byKind(defaults, "NetworkPolicy").length, 0);
assert.deepEqual(
  new Set(defaultDeployments.keys()),
  new Set(components.keys()),
);

for (const [name, deployment] of defaultDeployments) {
  assert.equal(deployment.spec.replicas, 1, `${name} default replicas`);
  assert.equal(deployment.spec.minReadySeconds, 5, `${name} minReadySeconds`);
  assert.deepEqual(deployment.spec.strategy, {
    type: "RollingUpdate",
    rollingUpdate: { maxUnavailable: 0, maxSurge: 1 },
  });

  const topology = deployment.spec.template.spec.topologySpreadConstraints;
  assert.equal(topology.length, 1, `${name} topology constraint count`);
  assert.equal(topology[0].maxSkew, 1);
  assert.equal(topology[0].topologyKey, "kubernetes.io/hostname");
  assert.equal(topology[0].whenUnsatisfiable, "ScheduleAnyway");
  assert.deepEqual(
    topology[0].labelSelector.matchLabels,
    deployment.spec.selector.matchLabels,
    `${name} topology selector must match its Deployment`,
  );
}

const fixedHa = render(
  "--set",
  "replicaCount=2",
  "--set",
  "availability.podDisruptionBudget.enabled=true",
);
const fixedHaDeployments = keyedByComponent(byKind(fixedHa, "Deployment"));
const fixedBudgets = keyedByComponent(byKind(fixedHa, "PodDisruptionBudget"));

assert.equal(byKind(fixedHa, "PodDisruptionBudget").length, components.size);
assert.equal(byKind(fixedHa, "HorizontalPodAutoscaler").length, 0);
for (const [name, budget] of fixedBudgets) {
  const deployment = fixedHaDeployments.get(name);
  assert.ok(deployment, `missing Deployment for PDB ${name}`);
  assert.equal(deployment.spec.replicas, 2);
  assert.equal(budget.apiVersion, "policy/v1");
  assert.equal(budget.spec.minAvailable, 1);
  assert.deepEqual(
    budget.spec.selector.matchLabels,
    deployment.spec.selector.matchLabels,
  );
}

const autoscaled = render(
  "--set",
  "availability.autoscaling.enabled=true",
  "--set",
  "availability.podDisruptionBudget.enabled=true",
);
const autoscaledDeployments = keyedByComponent(
  byKind(autoscaled, "Deployment"),
);
const autoscalers = keyedByComponent(
  byKind(autoscaled, "HorizontalPodAutoscaler"),
);

assert.equal(
  byKind(autoscaled, "HorizontalPodAutoscaler").length,
  components.size,
);
assert.equal(byKind(autoscaled, "PodDisruptionBudget").length, components.size);
for (const [name, autoscaler] of autoscalers) {
  const deployment = autoscaledDeployments.get(name);
  assert.ok(deployment, `missing Deployment for HPA ${name}`);
  assert.equal(
    "replicas" in deployment.spec,
    false,
    `${name} retains Helm replica ownership`,
  );
  assert.equal(autoscaler.apiVersion, "autoscaling/v2");
  assert.deepEqual(autoscaler.spec.scaleTargetRef, {
    apiVersion: "apps/v1",
    kind: "Deployment",
    name: deployment.metadata.name,
  });
  assert.equal(autoscaler.spec.minReplicas, 2);
  assert.equal(autoscaler.spec.maxReplicas, 5);
  assert.equal(autoscaler.spec.behavior.scaleUp.stabilizationWindowSeconds, 0);
  assert.deepEqual(autoscaler.spec.behavior.scaleUp.policies, [
    { type: "Percent", value: 100, periodSeconds: 60 },
    { type: "Pods", value: 2, periodSeconds: 60 },
  ]);
  assert.equal(
    autoscaler.spec.behavior.scaleDown.stabilizationWindowSeconds,
    300,
  );
  assert.deepEqual(autoscaler.spec.behavior.scaleDown.policies, [
    { type: "Percent", value: 25, periodSeconds: 60 },
  ]);
  assert.deepEqual(
    autoscaler.spec.metrics.map((metric) => ({
      name: metric.resource.name,
      type: metric.resource.target.type,
      target: metric.resource.target.averageUtilization,
    })),
    [
      { name: "cpu", type: "Utilization", target: 70 },
      { name: "memory", type: "Utilization", target: 80 },
    ],
  );
}

const isolated = render("--set", "networkPolicy.enabled=true");
const isolatedDeployments = keyedByComponent(byKind(isolated, "Deployment"));
const policies = keyedByComponent(byKind(isolated, "NetworkPolicy"));

assert.equal(byKind(isolated, "NetworkPolicy").length, components.size);
for (const [name, policy] of policies) {
  const expected = components.get(name);
  const deployment = isolatedDeployments.get(name);
  assert.ok(expected, `unexpected NetworkPolicy component ${name}`);
  assert.ok(deployment, `missing Deployment for NetworkPolicy ${name}`);
  assert.equal(policy.apiVersion, "networking.k8s.io/v1");
  assert.deepEqual(policy.spec.policyTypes, ["Ingress"]);
  assert.equal("egress" in policy.spec, false);
  assert.deepEqual(
    policy.spec.podSelector.matchLabels,
    deployment.spec.selector.matchLabels,
  );
  assert.equal(policy.spec.ingress.length, 1);
  assert.deepEqual(policy.spec.ingress[0].ports, [
    { protocol: "TCP", port: expected.port },
  ]);

  const peers = policy.spec.ingress[0].from;
  assert.ok(peers.every((peer) => peer.podSelector));
  assert.ok(peers.every((peer) => !("ipBlock" in peer)));
  const localPeers = peers.filter((peer) => !peer.namespaceSelector);
  const externalPeers = peers.filter((peer) => peer.namespaceSelector);

  assert.deepEqual(
    new Set(
      localPeers.map(
        (peer) => peer.podSelector.matchLabels["app.kubernetes.io/component"],
      ),
    ),
    new Set(["chart-test", ...expected.callers]),
    `${name} internal ingress graph`,
  );
  for (const peer of localPeers) {
    assert.equal(
      peer.podSelector.matchLabels["app.kubernetes.io/name"],
      "buildsphere",
    );
    assert.equal(
      peer.podSelector.matchLabels["app.kubernetes.io/instance"],
      "buildsphere",
    );
    assert.equal(Object.keys(peer.podSelector.matchLabels).length, 3);
  }

  const ingressPeers = externalPeers.filter(
    (peer) =>
      peer.namespaceSelector.matchLabels["kubernetes.io/metadata.name"] ===
      "ingress-nginx",
  );
  const metricsPeers = externalPeers.filter(
    (peer) =>
      peer.namespaceSelector.matchLabels["kubernetes.io/metadata.name"] ===
      "monitoring",
  );
  assert.equal(
    ingressPeers.length,
    expected.public ? 1 : 0,
    `${name} public peer count`,
  );
  assert.equal(
    metricsPeers.length,
    expected.metrics ? 1 : 0,
    `${name} metrics peer count`,
  );
  for (const peer of ingressPeers) {
    assert.deepEqual(peer.podSelector.matchLabels, {
      "app.kubernetes.io/name": "ingress-nginx",
    });
  }
  for (const peer of metricsPeers) {
    assert.deepEqual(peer.podSelector.matchLabels, {
      "app.kubernetes.io/name": "prometheus",
    });
  }
}

const customPeers = render(
  "--set",
  "networkPolicy.enabled=true",
  "--set-string",
  "networkPolicy.ingressController.namespaceSelector.matchLabels.kubernetes\\.io/metadata\\.name=edge-system",
  "--set-string",
  "networkPolicy.ingressController.podSelector.matchLabels.app\\.kubernetes\\.io/name=edge-controller",
  "--set-string",
  "networkPolicy.metricsCollector.namespaceSelector.matchLabels.kubernetes\\.io/metadata\\.name=telemetry",
  "--set-string",
  "networkPolicy.metricsCollector.podSelector.matchLabels.app\\.kubernetes\\.io/name=metrics-agent",
);
const customGateway = keyedByComponent(
  byKind(customPeers, "NetworkPolicy"),
).get("api-gateway");
const customExternalPeers = customGateway.spec.ingress[0].from.filter(
  (peer) => peer.namespaceSelector,
);
assert.deepEqual(
  new Set(
    customExternalPeers.map(
      (peer) =>
        peer.namespaceSelector.matchLabels["kubernetes.io/metadata.name"],
    ),
  ),
  new Set(["edge-system", "telemetry"]),
);
assert.deepEqual(
  new Set(
    customExternalPeers.map(
      (peer) => peer.podSelector.matchLabels["app.kubernetes.io/name"],
    ),
  ),
  new Set(["edge-controller", "metrics-agent"]),
);

expectFailure(
  ["--set", "availability.podDisruptionBudget.enabled=true"],
  /require at least two effective replicas/,
);
expectFailure(
  [
    "--set",
    "replicaCount=2",
    "--set",
    "availability.podDisruptionBudget.enabled=true",
    "--set",
    "availability.podDisruptionBudget.minAvailable=2",
  ],
  /minAvailable must be lower than the effective replica count/,
);
expectFailure(
  [
    "--set",
    "availability.autoscaling.minReplicas=6",
    "--set",
    "availability.autoscaling.maxReplicas=5",
  ],
  /minReplicas cannot exceed maxReplicas/,
);
expectFailure(
  ["--set", "availability.autoscaling.cpuUtilizationPercentage=0"],
  /cpuUtilizationPercentage/,
);
expectFailure(
  ["--set-string", "availability.topologySpread.topologyKey=bad key"],
  /topologyKey/,
);
expectFailure(
  [
    "--set",
    "networkPolicy.enabled=true",
    "--set",
    "ingress.enabled=true",
    "--set",
    "networkPolicy.ingressController.enabled=false",
  ],
  /ingressController must be enabled/,
);

console.log(
  JSON.stringify(
    {
      chartVersion: "0.4.0",
      defaultResources: defaults.length,
      deploymentsWithSafeRollout: defaultDeployments.size,
      optionalPodDisruptionBudgets: fixedBudgets.size,
      optionalHorizontalPodAutoscalers: autoscalers.size,
      optionalIngressNetworkPolicies: policies.size,
      internalCallerEdges: [...components.values()].reduce(
        (total, entry) => total + entry.callers.length,
        0,
      ),
      defaultOptionalResources: 0,
      secretsRendered: 0,
    },
    null,
    2,
  ),
);
