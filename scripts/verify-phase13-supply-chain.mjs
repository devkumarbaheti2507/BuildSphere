import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
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
const chart = path.join(repoRoot, "infrastructure", "helm", "buildsphere");
const evidenceScript = path.join(
  repoRoot,
  "scripts",
  "create-release-evidence.mjs",
);
const helm = process.env.HELM_BIN?.trim() || "helm";
const actionlint = process.env.ACTIONLINT_BIN?.trim();
const componentCatalog = JSON.parse(
  readFileSync(
    path.join(repoRoot, "infrastructure", "release", "components.json"),
    "utf8",
  ),
);
const components = componentCatalog.components;
const componentNames = components.map(({ name }) => name);
const expectedComponents = [
  "api-gateway",
  "auth-service",
  "project-service",
  "pipeline-service",
  "deployment-service",
  "monitoring-service",
  "logging-service",
  "ai-service",
  "analytics-service",
  "notification-service",
  "frontend",
];
const version = "1.2.3-rc.1";
const commit = "0123456789abcdef0123456789abcdef01234567";
const sourceRepository = "example/BuildSphere";
const sourceRef = `refs/tags/v${version}`;
const repositoryPrefix = "ghcr.io/example/buildsphere";
const workflowIdentity = `https://github.com/${sourceRepository}/.github/workflows/release.yml@${sourceRef}`;

const run = (command, args, { expectSuccess = true, cwd = repoRoot } = {}) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) {
    throw result.error;
  }
  if (expectSuccess && result.status !== 0) {
    throw new Error(
      result.stderr || result.stdout || `${command} ${args.join(" ")} failed`,
    );
  }
  if (!expectSuccess && result.status === 0) {
    throw new Error(`Expected command to fail: ${command} ${args.join(" ")}`);
  }
  return result;
};

const runHelm = (args, expectSuccess = true) =>
  run(helm, args, { expectSuccess });

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

const runEvidence = (command, options, expectSuccess = true) => {
  const args = [evidenceScript, command];
  for (const [name, value] of Object.entries(options)) {
    args.push(`--${name}`, value);
  }
  return run(process.execPath, args, { expectSuccess });
};

const sha256File = (filePath) =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

const readYaml = (filePath) => load(readFileSync(filePath, "utf8"));
const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

assert.equal(componentCatalog.schemaVersion, 1);
assert.deepEqual(componentNames, expectedComponents);
assert.equal(new Set(componentNames).size, 11);
assert.deepEqual(
  components.filter(({ type }) => type === "backend").map(({ port }) => port),
  [8080, 8081, 8082, 8083, 8084, 8085, 8086, 8087, 8088, 8089],
);
assert.deepEqual(
  components.filter(({ type }) => type === "frontend"),
  [{ name: "frontend", type: "frontend", port: 8080 }],
);

const chartMetadata = readYaml(path.join(chart, "Chart.yaml"));
assert.equal(chartMetadata.version, "0.4.0");
runHelm(["lint", "--strict", chart]);

const defaults = render();
assert.equal(defaults.length, 38);
const defaultDeployments = defaults.filter(({ kind }) => kind === "Deployment");
assert.equal(defaultDeployments.length, 11);
for (const deployment of defaultDeployments) {
  const component = deployment.metadata.labels["app.kubernetes.io/component"];
  assert.equal(
    deployment.spec.template.spec.containers[0].image,
    `ghcr.io/example/buildsphere/${component}:0.1.0`,
  );
}

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "buildsphere-phase13-"));

try {
  const digestValues = {
    image: {
      digestMode: true,
      digests: Object.fromEntries(
        componentNames.map((component, index) => [
          component,
          `sha256:${String(index + 1).padStart(64, "0")}`,
        ]),
      ),
    },
  };
  const digestValuesPath = path.join(tempRoot, "digest-values.yaml");
  const digestLines = [
    "image:",
    "  digestMode: true",
    "  digests:",
    ...componentNames.map(
      (component) =>
        `    ${component}: "${digestValues.image.digests[component]}"`,
    ),
    "",
  ];
  writeFileSync(digestValuesPath, digestLines.join("\n"), "utf8");

  const digestDocuments = render("--values", digestValuesPath);
  assert.equal(digestDocuments.length, 38);
  const digestDeployments = digestDocuments.filter(
    ({ kind }) => kind === "Deployment",
  );
  for (const deployment of digestDeployments) {
    const component = deployment.metadata.labels["app.kubernetes.io/component"];
    assert.equal(
      deployment.spec.template.spec.containers[0].image,
      `${repositoryPrefix}/${component}@${digestValues.image.digests[component]}`,
    );
    assert.ok(
      !deployment.spec.template.spec.containers[0].image.includes(":1.2.3"),
    );
  }
  const migrationJob = digestDocuments.find(({ kind }) => kind === "Job");
  const chartTest = digestDocuments.find(({ kind }) => kind === "Pod");
  assert.equal(
    migrationJob.spec.template.spec.containers[0].image,
    `${repositoryPrefix}/auth-service@${digestValues.image.digests["auth-service"]}`,
  );
  assert.equal(
    chartTest.spec.containers[0].image,
    `${repositoryPrefix}/api-gateway@${digestValues.image.digests["api-gateway"]}`,
  );

  const missingDigest = runHelm(
    ["template", "buildsphere", chart, "--set", "image.digestMode=true"],
    false,
  );
  assert.match(
    `${missingDigest.stderr}${missingDigest.stdout}`,
    /image\.digests\.api-gateway must be a sha256 digest/,
  );
  const malformedDigest = runHelm(
    [
      "template",
      "buildsphere",
      chart,
      "--values",
      digestValuesPath,
      "--set-string",
      "image.digests.frontend=sha256:abc",
    ],
    false,
  );
  assert.match(
    `${malformedDigest.stderr}${malformedDigest.stdout}`,
    /image(?:\.|\/)digests(?:\.|\/)frontend/,
  );

  const backendDockerfile = readFileSync(
    path.join(repoRoot, "infrastructure", "docker", "Dockerfile.backend"),
    "utf8",
  );
  const frontendDockerfile = readFileSync(
    path.join(repoRoot, "infrastructure", "docker", "Dockerfile.frontend"),
    "utf8",
  );
  for (const dockerfile of [backendDockerfile, frontendDockerfile]) {
    assert.match(dockerfile, /node:22\.23\.1-alpine@sha256:[0-9a-f]{64}/);
    for (const label of [
      "org.opencontainers.image.title",
      "org.opencontainers.image.source",
      "org.opencontainers.image.revision",
      "org.opencontainers.image.version",
      "org.opencontainers.image.licenses",
    ]) {
      assert.match(dockerfile, new RegExp(label.replaceAll(".", "\\.")));
    }
    assert.doesNotMatch(
      dockerfile,
      /^ARG\s+.*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY)/im,
    );
  }
  assert.match(
    frontendDockerfile,
    /nginx:1\.30\.3-alpine-slim@sha256:[0-9a-f]{64}/,
  );
  for (const runtimeTool of [
    "/usr/local/lib/node_modules/npm",
    "/usr/local/lib/node_modules/corepack",
    "/opt/yarn-v1.22.22",
    "/usr/local/bin/npm",
    "/usr/local/bin/npx",
    "/usr/local/bin/corepack",
    "/usr/local/bin/yarn",
    "/usr/local/bin/yarnpkg",
  ]) {
    assert.match(backendDockerfile, new RegExp(runtimeTool));
  }

  const workflowDirectory = path.join(repoRoot, ".github", "workflows");
  const workflowFiles = readdirSync(workflowDirectory)
    .filter((file) => /\.ya?ml$/.test(file))
    .sort();
  assert.deepEqual(workflowFiles, ["ci.yml", "release.yml"]);
  for (const file of workflowFiles) {
    const source = readFileSync(path.join(workflowDirectory, file), "utf8");
    const workflow = load(source);
    assert.ok(Object.hasOwn(workflow, "permissions"));
    const usesLines = source
      .split("\n")
      .filter((line) => /^\s+uses:\s+/.test(line));
    assert.ok(usesLines.length > 0);
    for (const line of usesLines) {
      assert.match(
        line,
        /^\s+uses:\s+[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}\s+#\s+v[0-9]/,
      );
    }
  }

  const ciWorkflow = readYaml(path.join(workflowDirectory, "ci.yml"));
  assert.deepEqual(ciWorkflow.permissions, { contents: "read" });
  assert.ok(
    !readFileSync(path.join(workflowDirectory, "ci.yml"), "utf8").includes(
      "packages: write",
    ),
  );
  assert.ok(
    !readFileSync(path.join(workflowDirectory, "ci.yml"), "utf8").includes(
      "id-token: write",
    ),
  );

  const releaseWorkflowPath = path.join(workflowDirectory, "release.yml");
  const releaseSource = readFileSync(releaseWorkflowPath, "utf8");
  const releaseWorkflow = load(releaseSource);
  assert.deepEqual(releaseWorkflow.permissions, {});
  assert.deepEqual(releaseWorkflow.on.push.tags, ["v*"]);
  assert.deepEqual(Object.keys(releaseWorkflow.jobs), [
    "prepare",
    "build-images",
    "certify",
  ]);
  assert.deepEqual(releaseWorkflow.jobs.prepare.permissions, {
    contents: "read",
  });
  assert.deepEqual(releaseWorkflow.jobs["build-images"].permissions, {
    contents: "read",
    "id-token": "write",
    packages: "write",
  });
  assert.deepEqual(releaseWorkflow.jobs.certify.permissions, {
    contents: "write",
    "id-token": "write",
    packages: "read",
  });
  assert.equal(
    releaseWorkflow.jobs["build-images"].environment,
    "production-release",
  );
  assert.equal(releaseWorkflow.jobs.certify.environment, "production-release");
  assert.equal((releaseSource.match(/provenance: mode=max/g) ?? []).length, 2);
  assert.equal((releaseSource.match(/sbom: true/g) ?? []).length, 2);
  assert.match(releaseSource, /--scanners vuln,secret/);
  assert.match(releaseSource, /--severity HIGH,CRITICAL/);
  assert.match(releaseSource, /cosign sign --yes/);
  assert.match(releaseSource, /cosign verify/);
  assert.equal(
    (releaseSource.match(/cosign sign-blob --yes/g) ?? []).length,
    2,
  );
  assert.match(releaseSource, /gh release create/);
  assert.match(releaseSource, /--draft/);
  assert.doesNotMatch(releaseSource, /\bkubectl\b/);
  assert.doesNotMatch(releaseSource, /helm (?:install|upgrade)/);

  const dependabot = readYaml(path.join(repoRoot, ".github", "dependabot.yml"));
  assert.equal(dependabot.version, 2);
  assert.deepEqual(
    dependabot.updates.map((update) => update["package-ecosystem"]),
    ["github-actions", "npm", "docker"],
  );
  assert.ok(
    dependabot.updates.every((update) => update.schedule.interval === "weekly"),
  );

  const packageMetadata = readJson(path.join(repoRoot, "package.json"));
  assert.equal(
    packageMetadata.scripts["verify:phase13:kind"],
    "env BUILDSPHERE_PHASE12_RELIABILITY=true BUILDSPHERE_PHASE13_DIGEST_MODE=true bash scripts/verify-phase10-kind.sh",
  );
  const kindVerifier = readFileSync(
    path.join(repoRoot, "scripts", "verify-phase10-kind.sh"),
    "utf8",
  );
  assert.match(kindVerifier, /BUILDSPHERE_PHASE13_DIGEST_MODE/);
  assert.match(kindVerifier, /docker image inspect --format '\{\{\.Id\}\}'/);
  assert.match(kindVerifier, /digestMode: \$\{phase13_digest_mode\}/);
  assert.match(kindVerifier, /ctr --namespace k8s\.io images tag/);

  const trivyInstaller = readFileSync(
    path.join(repoRoot, "scripts", "install-trivy.sh"),
    "utf8",
  );
  assert.match(trivyInstaller, /TRIVY_VERSION="0\.70\.0"/);
  assert.match(trivyInstaller, /TRIVY_LINUX_AMD64_SHA256="[0-9a-f]{64}"/);
  assert.match(trivyInstaller, /sha256sum --check --strict/);
  assert.match(trivyInstaller, /curl --fail --location/);
  assert.doesNotMatch(trivyInstaller, /latest/);

  const actionlintInstaller = readFileSync(
    path.join(repoRoot, "scripts", "install-actionlint.sh"),
    "utf8",
  );
  assert.match(actionlintInstaller, /ACTIONLINT_VERSION="1\.7\.12"/);
  assert.match(
    actionlintInstaller,
    /ACTIONLINT_LINUX_AMD64_SHA256="[0-9a-f]{64}"/,
  );
  assert.match(actionlintInstaller, /sha256sum --check --strict/);
  assert.match(actionlintInstaller, /curl --fail --location/);
  assert.doesNotMatch(actionlintInstaller, /latest/);
  if (actionlint) {
    run(actionlint, ["-color=false"]);
  }

  const fixtureInput = path.join(tempRoot, "components");
  const fixtureRecords = path.join(fixtureInput, "records");
  const fixtureSboms = path.join(fixtureInput, "sbom");
  mkdirSync(fixtureRecords, { recursive: true });
  mkdirSync(fixtureSboms, { recursive: true });
  for (const [index, component] of componentNames.entries()) {
    const sbomPath = path.join(fixtureSboms, `${component}.cdx.json`);
    writeFileSync(
      sbomPath,
      `${JSON.stringify(
        {
          bomFormat: "CycloneDX",
          specVersion: "1.6",
          serialNumber: `urn:uuid:00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          version: 1,
          metadata: {
            component: {
              type: "container",
              name: component,
              version,
            },
          },
          components: [],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    runEvidence("component", {
      component,
      "repository-prefix": repositoryPrefix,
      digest: digestValues.image.digests[component],
      version,
      commit,
      sbom: sbomPath,
      output: path.join(fixtureRecords, `${component}.json`),
    });
  }

  const chartArchive = path.join(tempRoot, `buildsphere-${version}.tgz`);
  writeFileSync(chartArchive, "deterministic chart fixture\n", "utf8");
  const bundleOptions = (inputDir, outputDir) => ({
    "input-dir": inputDir,
    chart: chartArchive,
    version,
    commit,
    "repository-prefix": repositoryPrefix,
    "source-repository": sourceRepository,
    "source-ref": sourceRef,
    "workflow-identity": workflowIdentity,
    "output-dir": outputDir,
  });
  const firstOutput = path.join(tempRoot, "release-one");
  const secondOutput = path.join(tempRoot, "release-two");
  runEvidence("bundle", bundleOptions(fixtureInput, firstOutput));
  runEvidence("bundle", bundleOptions(fixtureInput, secondOutput));

  const manifestPath = path.join(
    firstOutput,
    "buildsphere-release-manifest.json",
  );
  const manifest = readJson(manifestPath);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.release.version, version);
  assert.equal(manifest.release.sourceCommit, commit);
  assert.equal(manifest.signing.workflowIdentity, workflowIdentity);
  assert.deepEqual(manifest.scanPolicy, {
    scanners: ["vuln", "secret"],
    severities: ["HIGH", "CRITICAL"],
    ignoreUnfixed: false,
  });
  assert.equal(manifest.images.length, 11);
  assert.deepEqual(
    manifest.images.map(({ component }) => component),
    componentNames,
  );
  for (const image of manifest.images) {
    assert.equal(
      image.reference,
      `${repositoryPrefix}/${image.component}@${digestValues.image.digests[image.component]}`,
    );
    assert.equal(
      image.sbom.sha256,
      sha256File(path.join(firstOutput, image.sbom.file)),
    );
    assert.equal(image.sbom.file, `buildsphere-${image.component}.cdx.json`);
    assert.equal(path.basename(image.sbom.file), image.sbom.file);
  }

  const generatedValues = readYaml(
    path.join(firstOutput, "buildsphere-digest-values.yaml"),
  );
  assert.equal(generatedValues.image.repositoryPrefix, repositoryPrefix);
  assert.equal(generatedValues.image.tag, version);
  assert.equal(generatedValues.image.digestMode, true);
  assert.deepEqual(generatedValues.image.digests, digestValues.image.digests);

  const checksumLines = readFileSync(
    path.join(firstOutput, "SHA256SUMS"),
    "utf8",
  )
    .trim()
    .split("\n");
  assert.equal(checksumLines.length, 14);
  for (const line of checksumLines) {
    const match = line.match(/^([0-9a-f]{64})  (.+)$/);
    assert.ok(match);
    assert.equal(path.basename(match[2]), match[2]);
    assert.equal(match[1], sha256File(path.join(firstOutput, match[2])));
  }
  for (const file of [
    "buildsphere-release-manifest.json",
    "buildsphere-digest-values.yaml",
    "SHA256SUMS",
  ]) {
    assert.equal(
      readFileSync(path.join(firstOutput, file), "utf8"),
      readFileSync(path.join(secondOutput, file), "utf8"),
    );
  }
  const references = runEvidence("references", {
    manifest: manifestPath,
  })
    .stdout.trim()
    .split("\n");
  assert.deepEqual(
    references,
    manifest.images.map(({ reference }) => reference),
  );

  const malformedDigestResult = runEvidence(
    "component",
    {
      component: "frontend",
      "repository-prefix": repositoryPrefix,
      digest: "sha256:abc",
      version,
      commit,
      sbom: path.join(fixtureSboms, "frontend.cdx.json"),
      output: path.join(tempRoot, "invalid-record.json"),
    },
    false,
  );
  assert.match(malformedDigestResult.stderr, /Image digest must match/);

  const invalidSbomPath = path.join(tempRoot, "invalid-sbom.json");
  writeFileSync(
    invalidSbomPath,
    '{"bomFormat":"SPDX","specVersion":"1.0","version":1,"components":[]}\n',
    "utf8",
  );
  const invalidSbomResult = runEvidence(
    "component",
    {
      component: "frontend",
      "repository-prefix": repositoryPrefix,
      digest: digestValues.image.digests.frontend,
      version,
      commit,
      sbom: invalidSbomPath,
      output: path.join(tempRoot, "invalid-sbom-record.json"),
    },
    false,
  );
  assert.match(invalidSbomResult.stderr, /bomFormat must be CycloneDX/);

  const missingInput = path.join(tempRoot, "missing");
  cpSync(fixtureInput, missingInput, { recursive: true });
  unlinkSync(path.join(missingInput, "records", "frontend.json"));
  const missingResult = runEvidence(
    "bundle",
    bundleOptions(missingInput, path.join(tempRoot, "missing-output")),
    false,
  );
  assert.match(missingResult.stderr, /missing: frontend/);

  const duplicateInput = path.join(tempRoot, "duplicate");
  cpSync(fixtureInput, duplicateInput, { recursive: true });
  copyFileSync(
    path.join(duplicateInput, "records", "api-gateway.json"),
    path.join(duplicateInput, "records", "duplicate.json"),
  );
  const duplicateResult = runEvidence(
    "bundle",
    bundleOptions(duplicateInput, path.join(tempRoot, "duplicate-output")),
    false,
  );
  assert.match(duplicateResult.stderr, /Duplicate component record/);

  const unknownInput = path.join(tempRoot, "unknown");
  cpSync(fixtureInput, unknownInput, { recursive: true });
  const unknownRecordPath = path.join(unknownInput, "records", "frontend.json");
  const unknownRecord = readJson(unknownRecordPath);
  unknownRecord.component = "unknown-service";
  writeFileSync(
    unknownRecordPath,
    `${JSON.stringify(unknownRecord, null, 2)}\n`,
    "utf8",
  );
  const unknownResult = runEvidence(
    "bundle",
    bundleOptions(unknownInput, path.join(tempRoot, "unknown-output")),
    false,
  );
  assert.match(unknownResult.stderr, /Unknown release component/);

  const mismatchInput = path.join(tempRoot, "mismatch");
  cpSync(fixtureInput, mismatchInput, { recursive: true });
  const mismatchRecordPath = path.join(
    mismatchInput,
    "records",
    "frontend.json",
  );
  const mismatchRecord = readJson(mismatchRecordPath);
  mismatchRecord.sourceCommit = "f".repeat(40);
  writeFileSync(
    mismatchRecordPath,
    `${JSON.stringify(mismatchRecord, null, 2)}\n`,
    "utf8",
  );
  const mismatchResult = runEvidence(
    "bundle",
    bundleOptions(mismatchInput, path.join(tempRoot, "mismatch-output")),
    false,
  );
  assert.match(mismatchResult.stderr, /identity mismatch: frontend/);

  process.stdout.write(
    `${JSON.stringify(
      {
        chartVersion: chartMetadata.version,
        defaultResources: defaults.length,
        digestPinnedDeployments: digestDeployments.length,
        releaseComponents: components.length,
        cycloneDxSboms: manifest.images.length,
        checksumEntries: checksumLines.length,
        pinnedWorkflowActions: workflowFiles.reduce(
          (total, file) =>
            total +
            (
              readFileSync(path.join(workflowDirectory, file), "utf8").match(
                /^\s+uses:\s+/gm,
              ) ?? []
            ).length,
          0,
        ),
        negativeEvidenceCases: 6,
        runtimePackageManagersRemoved: true,
        digestQualifiedKindMode: true,
        externalPublications: 0,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
