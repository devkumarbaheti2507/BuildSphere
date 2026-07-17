import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { load, loadAll } from "js-yaml";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const prerequisiteChart = path.join(
  repoRoot,
  "infrastructure",
  "helm",
  "buildsphere-personal-prerequisites",
);
const applicationChart = path.join(
  repoRoot,
  "infrastructure",
  "helm",
  "buildsphere",
);
const profileDir = path.join(
  repoRoot,
  "infrastructure",
  "deployment",
  "free-tier",
);
const evidenceScript = path.join(
  repoRoot,
  "scripts",
  "create-release-evidence.mjs",
);
const tempRoot = mkdtempSync(path.join(os.tmpdir(), "buildsphere-phase14-"));

const failOutput = (result) =>
  `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, ...options.env },
  });
  const expectedSuccess = options.success !== false;
  if (expectedSuccess && result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${failOutput(result)}`,
    );
  }
  if (!expectedSuccess && result.status === 0) {
    throw new Error(`${command} ${args.join(" ")} unexpectedly succeeded`);
  }
  return result;
};

const resolveHelm = () => {
  const candidates = [
    process.env.HELM_BIN,
    path.join(repoRoot, ".cache", "tools", "helm"),
    "helm",
  ].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["version", "--short"], {
      encoding: "utf8",
    });
    if (result.status === 0) return candidate;
  }
  throw new Error("Helm is required; run scripts/check-toolchain.sh first");
};

const helm = resolveHelm();

const render = (chart, args = [], success = true) => {
  const result = run(
    helm,
    [
      "template",
      "buildsphere-phase14",
      chart,
      "--namespace",
      "buildsphere",
      ...args,
    ],
    { success },
  );
  if (!success) return result;
  return loadAll(result.stdout).filter(
    (document) => document && typeof document === "object",
  );
};

const byKind = (documents, kind) =>
  documents.filter((document) => document.kind === kind);

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));
const sha256File = (filePath) =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

const evidence = (command, options, success = true) => {
  const args = [evidenceScript, command];
  for (const [name, value] of Object.entries(options)) {
    args.push(`--${name}`, value);
  }
  return run(process.execPath, args, { success });
};

try {
  run(helm, ["lint", "--strict", prerequisiteChart]);
  run(helm, ["lint", "--strict", applicationChart]);
  assert.equal(
    readJson(path.join(prerequisiteChart, "values.schema.json")).type,
    "object",
  );
  assert.equal(
    load(readFileSync(path.join(applicationChart, "Chart.yaml"), "utf8"))
      .version,
    "0.5.0",
  );

  const prerequisites = render(prerequisiteChart);
  assert.deepEqual(
    Object.fromEntries(
      [...new Set(prerequisites.map(({ kind }) => kind))]
        .sort()
        .map((kind) => [kind, byKind(prerequisites, kind).length]),
    ),
    {
      NetworkPolicy: 1,
      Pod: 1,
      Service: 1,
      ServiceAccount: 1,
      StatefulSet: 1,
    },
  );
  assert.equal(byKind(prerequisites, "Secret").length, 0);

  const statefulSet = byKind(prerequisites, "StatefulSet")[0];
  assert.equal(statefulSet.spec.replicas, 1);
  assert.deepEqual(statefulSet.spec.persistentVolumeClaimRetentionPolicy, {
    whenDeleted: "Retain",
    whenScaled: "Retain",
  });
  assert.equal(
    statefulSet.spec.template.spec.automountServiceAccountToken,
    false,
  );
  assert.deepEqual(statefulSet.spec.template.spec.securityContext, {
    runAsNonRoot: true,
    runAsUser: 70,
    runAsGroup: 70,
    fsGroup: 70,
    fsGroupChangePolicy: "OnRootMismatch",
    seccompProfile: { type: "RuntimeDefault" },
  });
  const postgres = statefulSet.spec.template.spec.containers[0];
  assert.match(postgres.image, /^postgres:16-alpine@sha256:[0-9a-f]{64}$/);
  assert.equal(postgres.securityContext.readOnlyRootFilesystem, true);
  assert.equal(postgres.securityContext.allowPrivilegeEscalation, false);
  assert.deepEqual(postgres.securityContext.capabilities.drop, ["ALL"]);
  assert.deepEqual(postgres.volumeMounts.map(({ name }) => name).sort(), [
    "data",
    "socket",
    "tmp",
  ]);
  assert.equal(
    statefulSet.spec.volumeClaimTemplates[0].spec.resources.requests.storage,
    "20Gi",
  );

  const databasePolicy = byKind(prerequisites, "NetworkPolicy")[0];
  assert.deepEqual(databasePolicy.spec.policyTypes, ["Ingress"]);
  assert.equal(databasePolicy.spec.egress, undefined);
  assert.deepEqual(
    databasePolicy.spec.ingress[0].from[0].podSelector.matchLabels,
    { "app.kubernetes.io/part-of": "buildsphere" },
  );
  assert.deepEqual(databasePolicy.spec.ingress[0].ports, [
    { port: "postgresql", protocol: "TCP" },
  ]);

  const databaseTest = byKind(prerequisites, "Pod")[0];
  assert.equal(databaseTest.metadata.annotations["helm.sh/hook"], "test");
  assert.equal(databaseTest.spec.automountServiceAccountToken, false);
  assert.match(databaseTest.spec.containers[0].args[0], /SELECT 1/);
  assert.deepEqual(
    databaseTest.spec.containers[0].env.map(({ name }) => name),
    ["POSTGRES_DB", "POSTGRES_USER", "PGPASSWORD"],
  );

  const prerequisiteValues = path.join(
    profileDir,
    "prerequisites-values.example.yaml",
  );
  const tlsPrerequisites = render(prerequisiteChart, [
    "--values",
    prerequisiteValues,
  ]);
  assert.equal(byKind(tlsPrerequisites, "Secret").length, 0);
  assert.equal(byKind(tlsPrerequisites, "Issuer").length, 1);
  assert.equal(byKind(tlsPrerequisites, "Certificate").length, 1);
  const certificate = byKind(tlsPrerequisites, "Certificate")[0];
  assert.equal(certificate.spec.secretName, "buildsphere-tls");
  assert.deepEqual(certificate.spec.dnsNames, [
    "buildsphere.203-0-113-10.sslip.io",
  ]);

  for (const invalidArgs of [
    ["--set", "tls.enabled=true"],
    ["--set", "postgresql.image.tag=latest"],
    ["--set", "postgresql.persistence.size=0Gi"],
    ["--set", "postgresql.resources.requests.cpu=0m"],
  ]) {
    render(prerequisiteChart, invalidArgs, false);
  }

  const applicationValues = path.join(
    profileDir,
    "buildsphere-values.example.yaml",
  );
  const application = render(applicationChart, ["--values", applicationValues]);
  assert.equal(byKind(application, "Deployment").length, 11);
  assert.equal(byKind(application, "Ingress").length, 1);
  for (const absentKind of [
    "HorizontalPodAutoscaler",
    "PodDisruptionBudget",
    "ServiceMonitor",
    "PrometheusRule",
    "NetworkPolicy",
    "Secret",
  ]) {
    assert.equal(byKind(application, absentKind).length, 0);
  }
  for (const deployment of byKind(application, "Deployment")) {
    assert.equal(deployment.spec.replicas, 1);
    assert.equal(
      deployment.spec.template.metadata.labels["app.kubernetes.io/part-of"],
      "buildsphere",
    );
  }
  const applicationIngress = byKind(application, "Ingress")[0];
  assert.equal(applicationIngress.spec.ingressClassName, "traefik");
  assert.equal(
    applicationIngress.spec.rules[0].host,
    "buildsphere.203-0-113-10.sslip.io",
  );
  assert.equal(applicationIngress.spec.tls[0].secretName, "buildsphere-tls");
  const applicationConfig = byKind(application, "ConfigMap")[0];
  assert.equal(applicationConfig.data.KUBERNETES_EXECUTION_ENABLED, "false");

  const bootstrap = path.join(
    repoRoot,
    "scripts",
    "create-personal-deployment-secrets.sh",
  );
  run("sh", ["-n", bootstrap]);
  const bootstrapSource = readFileSync(bootstrap, "utf8");
  assert.match(bootstrapSource, /BUILDSPHERE_CONFIRM_CONTEXT/);
  assert.match(bootstrapSource, /refusing implicit rotation/);
  assert.doesNotMatch(bootstrapSource, /set -x/);
  assert.doesNotMatch(bootstrapSource, /KUBERNETES_CREDENTIAL_ENCRYPTION_KEY=/);

  const fakeKubectl = path.join(tempRoot, "kubectl");
  const capturedSecrets = path.join(tempRoot, "captured-secrets.json");
  writeFileSync(
    fakeKubectl,
    `#!/bin/sh
set -eu
case " $* " in
  " config current-context ") printf 'phase14-context\\n'; exit 0 ;;
  *" get namespace "*) exit 1 ;;
  *" create namespace "*) exit 0 ;;
  *" get secret "*) [ "\${FAKE_SECRET_EXISTS:-false}" = "true" ] && exit 0; exit 1 ;;
  *" create --dry-run=server -f - "*) cat >/dev/null; exit 0 ;;
  *" create -f - "*) cat > "\${CAPTURE_PATH}"; exit 0 ;;
esac
printf 'Unexpected fake kubectl call: %s\\n' "$*" >&2
exit 2
`,
    "utf8",
  );
  chmodSync(fakeKubectl, 0o755);

  const bootstrapEnvironment = {
    KUBECTL_BIN: fakeKubectl,
    CAPTURE_PATH: capturedSecrets,
    GITHUB_CLIENT_ID: "phase14-client-id",
    GITHUB_CLIENT_SECRET: "phase14-client-secret",
  };
  const confirmationFailure = run("sh", [bootstrap], {
    success: false,
    env: {
      ...bootstrapEnvironment,
      BUILDSPHERE_CONFIRM_CONTEXT: "wrong-context",
    },
  });
  assert.match(confirmationFailure.stderr, /phase14-context/);

  const existingCapture = path.join(tempRoot, "existing-secret.json");
  const existingSecretFailure = run("sh", [bootstrap], {
    success: false,
    env: {
      ...bootstrapEnvironment,
      BUILDSPHERE_CONFIRM_CONTEXT: "phase14-context",
      CAPTURE_PATH: existingCapture,
      FAKE_SECRET_EXISTS: "true",
    },
  });
  assert.match(existingSecretFailure.stderr, /refusing implicit rotation/);
  assert.equal(existsSync(existingCapture), false);

  const confirmedEnvironment = {
    ...bootstrapEnvironment,
    BUILDSPHERE_CONFIRM_CONTEXT: "phase14-context",
  };
  assert.equal(
    confirmedEnvironment.BUILDSPHERE_CONFIRM_CONTEXT,
    "phase14-context",
  );
  run(
    "sh",
    ["-c", '[ "${BUILDSPHERE_CONFIRM_CONTEXT:-}" = "phase14-context" ]'],
    { env: confirmedEnvironment },
  );
  assert.equal(
    run(fakeKubectl, ["config", "current-context"], {
      env: confirmedEnvironment,
    }).stdout.trim(),
    "phase14-context",
  );
  const bootstrapResult = run("sh", [bootstrap], {
    env: confirmedEnvironment,
  });
  assert.doesNotMatch(bootstrapResult.stdout, /phase14-client-secret/);
  const secretList = readJson(capturedSecrets);
  assert.equal(secretList.kind, "List");
  assert.deepEqual(
    secretList.items.map(({ metadata }) => metadata.name),
    ["buildsphere-database", "buildsphere-runtime"],
  );
  const decode = (value) => Buffer.from(value, "base64").toString("utf8");
  const databaseData = secretList.items[0].data;
  const runtimeData = secretList.items[1].data;
  assert.equal(decode(databaseData.POSTGRES_DB), "buildsphere");
  assert.equal(
    decode(runtimeData.POSTGRES_PASSWORD),
    decode(databaseData.POSTGRES_PASSWORD),
  );
  assert.equal(decode(runtimeData.GITHUB_CLIENT_ID), "phase14-client-id");
  assert.equal(
    decode(runtimeData.GITHUB_CLIENT_SECRET),
    "phase14-client-secret",
  );
  assert.equal(
    Buffer.from(decode(runtimeData.GITHUB_TOKEN_ENCRYPTION_KEY), "base64")
      .length,
    32,
  );
  assert.match(
    decode(runtimeData.DATABASE_URL),
    /^postgresql:\/\/buildsphere:[0-9a-f]{48}@buildsphere-postgres:5432\/buildsphere$/,
  );

  const componentCatalog = readJson(
    path.join(repoRoot, "infrastructure", "release", "components.json"),
  );
  const componentNames = componentCatalog.components.map(({ name }) => name);
  const fixtureInput = path.join(tempRoot, "evidence", "components");
  const recordsDir = path.join(fixtureInput, "records");
  const sbomsDir = path.join(fixtureInput, "sbom");
  mkdirSync(recordsDir, { recursive: true });
  mkdirSync(sbomsDir, { recursive: true });
  const version = "1.2.3";
  const commit = "1".repeat(40);
  const repositoryPrefix = "ghcr.io/example/buildsphere";
  const digestByComponent = {};
  for (const [index, component] of componentNames.entries()) {
    const sbom = {
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      serialNumber: `urn:uuid:00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      version: 1,
      components: [],
    };
    const amd64Sbom = path.join(sbomsDir, `${component}-linux-amd64.cdx.json`);
    const arm64Sbom = path.join(sbomsDir, `${component}-linux-arm64.cdx.json`);
    writeFileSync(amd64Sbom, `${JSON.stringify(sbom, null, 2)}\n`, "utf8");
    writeFileSync(arm64Sbom, `${JSON.stringify(sbom, null, 2)}\n`, "utf8");
    const digest = `sha256:${createHash("sha256").update(component).digest("hex")}`;
    digestByComponent[component] = digest;
    evidence("component", {
      component,
      "repository-prefix": repositoryPrefix,
      digest,
      version,
      commit,
      "sbom-amd64": amd64Sbom,
      "sbom-arm64": arm64Sbom,
      output: path.join(recordsDir, `${component}.json`),
    });
  }

  const chartFixture = path.join(tempRoot, `buildsphere-${version}.tgz`);
  writeFileSync(chartFixture, "phase14 chart fixture\n", "utf8");
  const releaseOutput = path.join(tempRoot, "evidence", "release");
  const bundleOptions = {
    "input-dir": fixtureInput,
    chart: chartFixture,
    version,
    commit,
    "repository-prefix": repositoryPrefix,
    "source-repository": "example/buildsphere",
    "source-ref": `refs/tags/v${version}`,
    "workflow-identity": `https://github.com/example/buildsphere/.github/workflows/release.yml@refs/tags/v${version}`,
    "output-dir": releaseOutput,
  };
  evidence("bundle", bundleOptions);
  const manifestPath = path.join(
    releaseOutput,
    "buildsphere-release-manifest.json",
  );
  const manifest = readJson(manifestPath);
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.images.length, 11);
  for (const image of manifest.images) {
    assert.equal(image.digest, digestByComponent[image.component]);
    assert.deepEqual(
      image.platforms.map(({ name }) => name),
      ["linux/amd64", "linux/arm64"],
    );
    for (const platform of image.platforms) {
      assert.equal(
        platform.sbom.sha256,
        sha256File(path.join(releaseOutput, platform.sbom.file)),
      );
      assert.equal(path.basename(platform.sbom.file), platform.sbom.file);
    }
  }
  const checksumLines = readFileSync(
    path.join(releaseOutput, "SHA256SUMS"),
    "utf8",
  )
    .trim()
    .split("\n");
  assert.equal(checksumLines.length, 25);
  assert.equal(
    readdirSync(releaseOutput).filter((file) => !file.startsWith(".")).length,
    26,
  );
  for (const line of checksumLines) {
    const match = line.match(/^([0-9a-f]{64})  (.+)$/);
    assert.ok(match);
    assert.equal(match[1], sha256File(path.join(releaseOutput, match[2])));
  }
  const referenceResult = evidence("references", { manifest: manifestPath });
  const references = referenceResult.stdout.trim().split("\n");
  assert.equal(references.length, 11, JSON.stringify(referenceResult.stdout));

  const invalidInput = path.join(tempRoot, "evidence", "invalid-platforms");
  cpSync(fixtureInput, invalidInput, { recursive: true });
  const invalidRecordPath = path.join(invalidInput, "records", "frontend.json");
  const invalidRecord = readJson(invalidRecordPath);
  invalidRecord.platforms.reverse();
  writeFileSync(
    invalidRecordPath,
    `${JSON.stringify(invalidRecord, null, 2)}\n`,
    "utf8",
  );
  const invalidBundle = evidence(
    "bundle",
    {
      ...bundleOptions,
      "input-dir": invalidInput,
      "output-dir": path.join(tempRoot, "evidence", "invalid-output"),
    },
    false,
  );
  assert.match(
    invalidBundle.stderr,
    /platforms\[0\]\.name must be linux\/amd64/,
  );

  const releaseWorkflow = readFileSync(
    path.join(repoRoot, ".github", "workflows", "release.yml"),
    "utf8",
  );
  const actionReferences = releaseWorkflow
    .split("\n")
    .filter((line) => /^\s+uses:\s+/.test(line));
  assert.ok(actionReferences.length > 0);
  for (const line of actionReferences) {
    assert.match(
      line,
      /^\s+uses:\s+[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}\s+#\s+v[0-9]/,
    );
  }
  assert.match(
    releaseWorkflow,
    /docker\/setup-qemu-action@[0-9a-f]{40}\s+#\s+v4\.1\.0/,
  );
  assert.equal(
    (releaseWorkflow.match(/platforms: linux\/amd64,linux\/arm64/g) ?? [])
      .length,
    2,
  );
  assert.match(releaseWorkflow, /scan_platform linux\/amd64 amd64/);
  assert.match(releaseWorkflow, /scan_platform linux\/arm64 arm64/);
  assert.match(releaseWorkflow, /--sbom-amd64/);
  assert.match(releaseWorkflow, /--sbom-arm64/);
  assert.ok(
    releaseWorkflow.indexOf("Scan both immutable platforms") <
      releaseWorkflow.indexOf("Sign immutable image digest"),
  );

  const trivyInstaller = readFileSync(
    path.join(repoRoot, "scripts", "install-trivy.sh"),
    "utf8",
  );
  const actionlintInstaller = readFileSync(
    path.join(repoRoot, "scripts", "install-actionlint.sh"),
    "utf8",
  );
  assert.match(trivyInstaller, /TRIVY_LINUX_ARM64_SHA256="[0-9a-f]{64}"/);
  assert.match(trivyInstaller, /Linux-ARM64\.tar\.gz/);
  assert.match(
    actionlintInstaller,
    /ACTIONLINT_LINUX_ARM64_SHA256="[0-9a-f]{64}"/,
  );
  assert.match(actionlintInstaller, /linux_arm64\.tar\.gz/);

  const kindVerifier = readFileSync(
    path.join(repoRoot, "scripts", "verify-phase10-kind.sh"),
    "utf8",
  );
  assert.match(kindVerifier, /BUILDSPHERE_PHASE14_PERSONAL_PROFILE/);
  assert.match(kindVerifier, /buildsphere-personal-prerequisites/);
  assert.match(kindVerifier, /helm_bin.*test.*prerequisite_release/s);
  assert.match(kindVerifier, /buildsphere-database/);
  run("bash", ["-n", path.join(repoRoot, "scripts", "verify-phase10-kind.sh")]);

  const packageMetadata = readJson(path.join(repoRoot, "package.json"));
  assert.equal(
    packageMetadata.scripts["verify:phase14:kind"],
    "env BUILDSPHERE_PHASE13_DIGEST_MODE=true BUILDSPHERE_PHASE14_PERSONAL_PROFILE=true bash scripts/verify-phase10-kind.sh",
  );

  const ciWorkflow = load(
    readFileSync(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf8"),
  );
  const buildTestSteps = ciWorkflow.jobs["build-test"].steps;
  assert.ok(
    buildTestSteps.some((step) => step.run === "pnpm verify:phase14"),
    "CI must run the Phase 14 verifier",
  );

  const knowledgeGraph = readJson(
    path.join(repoRoot, "docs", "project-knowledge-graph.json"),
  );
  const knowledgeIds = new Set(knowledgeGraph.nodes.map(({ id }) => id));
  assert.equal(knowledgeIds.size, knowledgeGraph.nodes.length);
  assert.ok(knowledgeIds.has("capability.personal_free_tier_deployment"));
  assert.ok(
    knowledgeIds.has("workflow.phase14_personal_deployment_verification"),
  );
  assert.deepEqual(
    knowledgeGraph.edges.filter(
      ({ from, to }) => !knowledgeIds.has(from) || !knowledgeIds.has(to),
    ),
    [],
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        prerequisiteResources: prerequisites.length,
        tlsResources: tlsPrerequisites.length,
        applicationDeployments: byKind(application, "Deployment").length,
        releaseImages: manifest.images.length,
        platformSboms: manifest.images.length * 2,
        checksumEntries: checksumLines.length,
        releaseFiles: readdirSync(releaseOutput).length,
        knowledgeNodes: knowledgeGraph.nodes.length,
        knowledgeEdges: knowledgeGraph.edges.length,
      },
      null,
      2,
    )}\nPhase 14 personal deployment verification passed\n`,
  );
} finally {
  if (process.env.BUILDSPHERE_KEEP_PHASE14_TEMP === "true") {
    process.stderr.write(`Phase 14 temporary files: ${tempRoot}\n`);
  } else {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}
