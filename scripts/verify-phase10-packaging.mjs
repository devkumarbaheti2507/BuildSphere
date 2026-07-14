import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

runHelm(["lint", "--strict", chart]);

const documents = render();
const expectedComponents = new Set([
  "ai-service",
  "analytics-service",
  "api-gateway",
  "auth-service",
  "deployment-service",
  "frontend",
  "logging-service",
  "monitoring-service",
  "notification-service",
  "pipeline-service",
  "project-service",
]);

assert.equal(
  byKind(documents, "Secret").length,
  0,
  "chart must not render secrets",
);
assert.equal(byKind(documents, "Deployment").length, 11);
assert.equal(byKind(documents, "Service").length, 11);
assert.equal(byKind(documents, "ServiceAccount").length, 13);
assert.equal(byKind(documents, "Job").length, 1);
assert.equal(byKind(documents, "Pod").length, 1);
assert.equal(byKind(documents, "Ingress").length, 0);
assert.deepEqual(
  new Set(byKind(documents, "Deployment").map(component)),
  expectedComponents,
);
assert.deepEqual(
  new Set(byKind(documents, "Service").map(component)),
  expectedComponents,
);

for (const account of byKind(documents, "ServiceAccount")) {
  assert.equal(account.automountServiceAccountToken, false);
}

for (const deployment of byKind(documents, "Deployment")) {
  const pod = deployment.spec.template.spec;
  assert.equal(pod.automountServiceAccountToken, false);
  assert.ok(pod.serviceAccountName);
  assert.equal(pod.securityContext.runAsNonRoot, true);
  assert.equal(pod.securityContext.seccompProfile.type, "RuntimeDefault");
  assert.ok(pod.terminationGracePeriodSeconds >= 10);
  assert.ok(pod.volumes.some((volume) => volume.name === "tmp"));

  for (const container of pod.containers) {
    assert.equal(container.securityContext.allowPrivilegeEscalation, false);
    assert.equal(container.securityContext.readOnlyRootFilesystem, true);
    assert.equal(container.securityContext.runAsNonRoot, true);
    assert.deepEqual(container.securityContext.capabilities.drop, ["ALL"]);
    assert.ok(container.resources.requests.cpu);
    assert.ok(container.resources.requests.memory);
    assert.ok(container.resources.limits.cpu);
    assert.ok(container.resources.limits.memory);
    assert.ok(container.startupProbe?.httpGet);
    assert.ok(container.readinessProbe?.httpGet);
    assert.ok(container.livenessProbe?.httpGet);
    assert.ok(
      container.volumeMounts.some(
        (volume) => volume.name === "tmp" && volume.mountPath === "/tmp",
      ),
    );
    assert.ok(!container.image.endsWith(":latest"));
  }
}

const migration = byKind(documents, "Job")[0];
assert.match(migration.metadata.annotations["helm.sh/hook"], /pre-install/);
assert.match(migration.metadata.annotations["helm.sh/hook"], /pre-upgrade/);
assert.equal(migration.spec.template.spec.automountServiceAccountToken, false);
assert.deepEqual(migration.spec.template.spec.containers[0].command, [
  "node",
  "node_modules/@buildsphere/service-core/dist/migrate.js",
]);
assert.deepEqual(
  migration.spec.template.spec.containers[0].envFrom.map((entry) =>
    Object.keys(entry).sort(),
  ),
  [["secretRef"]],
);

const chartTest = byKind(documents, "Pod")[0];
assert.equal(component(chartTest), "chart-test");
assert.equal(chartTest.metadata.annotations["helm.sh/hook"], "test");
assert.equal(chartTest.spec.automountServiceAccountToken, false);
assert.ok(chartTest.spec.serviceAccountName.endsWith("-chart-test"));
assert.equal(chartTest.spec.securityContext.runAsNonRoot, true);
assert.equal(
  chartTest.spec.securityContext.seccompProfile.type,
  "RuntimeDefault",
);
assert.ok(chartTest.spec.volumes.some((volume) => volume.name === "tmp"));
const chartTestContainer = chartTest.spec.containers[0];
assert.equal(
  chartTestContainer.workingDir,
  "/app/node_modules/@buildsphere/service-core",
);
assert.equal(
  chartTestContainer.securityContext.allowPrivilegeEscalation,
  false,
);
assert.equal(chartTestContainer.securityContext.readOnlyRootFilesystem, true);
assert.equal(chartTestContainer.securityContext.runAsNonRoot, true);
assert.deepEqual(chartTestContainer.securityContext.capabilities.drop, ["ALL"]);
assert.ok(chartTestContainer.resources.requests.cpu);
assert.ok(chartTestContainer.resources.requests.memory);
assert.ok(chartTestContainer.resources.limits.cpu);
assert.ok(chartTestContainer.resources.limits.memory);
assert.deepEqual(
  chartTestContainer.envFrom.map((entry) => Object.keys(entry).sort()),
  [["secretRef"]],
);
assert.match(chartTestContainer.args[0], /\/api\/auth\/providers/);
assert.match(chartTestContainer.args[0], /schema_migrations/);
assert.ok(!chartTestContainer.image.endsWith(":latest"));

const config = byKind(documents, "ConfigMap")[0];
assert.equal(config.data.KUBERNETES_EXECUTION_ENABLED, "false");
for (const secretKey of [
  "DATABASE_URL",
  "POSTGRES_PASSWORD",
  "JWT_ACCESS_TOKEN_SECRET",
  "JWT_REFRESH_TOKEN_SECRET",
  "INTERNAL_SERVICE_TOKEN",
  "GITHUB_CLIENT_SECRET",
  "KUBERNETES_CREDENTIAL_ENCRYPTION_KEY",
]) {
  assert.equal(config.data[secretKey], undefined);
}

const ingressDocuments = render("--set", "ingress.enabled=true");
const ingress = byKind(ingressDocuments, "Ingress")[0];
assert.ok(ingress);
assert.deepEqual(
  ingress.spec.rules[0].http.paths.map((entry) => entry.path),
  ["/api", "/"],
);
assert.equal(ingress.spec.tls[0].secretName, "buildsphere-tls");

runHelm(["template", "buildsphere", chart, "--set", "image.tag=latest"], false);
runHelm(
  [
    "template",
    "buildsphere",
    chart,
    "--set",
    "deploymentExecution.enabled=true",
  ],
  false,
);
render(
  "--set",
  "deploymentExecution.enabled=true",
  "--set-string",
  "deploymentExecution.allowedServerHosts[0]=127.0.0.1:6443",
);

const backendDockerfile = readFileSync(
  path.join(repoRoot, "infrastructure", "docker", "Dockerfile.backend"),
  "utf8",
);
const frontendDockerfile = readFileSync(
  path.join(repoRoot, "infrastructure", "docker", "Dockerfile.frontend"),
  "utf8",
);
const dockerIgnore = readFileSync(path.join(repoRoot, ".dockerignore"), "utf8");
const nginxConfig = readFileSync(
  path.join(repoRoot, "infrastructure", "nginx", "frontend.conf"),
  "utf8",
);

for (const service of [...expectedComponents].filter(
  (name) => name !== "frontend",
)) {
  assert.match(backendDockerfile, new RegExp(`\\b${service}\\b`));
  const packageJson = JSON.parse(
    readFileSync(
      path.join(repoRoot, "backend", service, "package.json"),
      "utf8",
    ),
  );
  assert.deepEqual(packageJson.files, ["dist"]);
  assert.equal(
    existsSync(path.join(repoRoot, "backend", service, "Dockerfile")),
    false,
  );
}
assert.match(backendDockerfile, /pnpm install --offline --frozen-lockfile/);
assert.match(backendDockerfile, /deploy --prod/);
assert.match(backendDockerfile, /ENV BUILDSPHERE_ROOT=\/app/);
assert.match(backendDockerfile, /USER node/);
assert.match(frontendDockerfile, /ARG VITE_API_URL=\/api/);
assert.match(frontendDockerfile, /USER nginx/);
assert.match(dockerIgnore, /^\.env\*/m);
assert.match(dockerIgnore, /^\*\*\/node_modules$/m);
assert.match(nginxConfig, /try_files \$uri \$uri\/ \/index\.html/);
assert.match(nginxConfig, /location = \/healthz/);

console.log(
  JSON.stringify(
    {
      chart: "buildsphere",
      renderedResources: documents.length,
      deployments: byKind(documents, "Deployment").length,
      services: byKind(documents, "Service").length,
      serviceAccounts: byKind(documents, "ServiceAccount").length,
      migrationJobs: byKind(documents, "Job").length,
      chartTestPods: byKind(documents, "Pod").length,
      secretsRendered: 0,
      executionEnabledByDefault: false,
      ingressRoutes: ["/api", "/"],
    },
    null,
    2,
  ),
);
