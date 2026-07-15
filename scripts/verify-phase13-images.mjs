import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const catalog = JSON.parse(
  readFileSync(
    path.join(repoRoot, "infrastructure", "release", "components.json"),
    "utf8",
  ),
);
const docker = process.env.DOCKER_BIN?.trim() || "docker";
const trivy = process.env.TRIVY_BIN?.trim() || "trivy";
const tag = process.env.PHASE13_IMAGE_TAG?.trim() || "phase10-local";
const cacheDir =
  process.env.TRIVY_CACHE_DIR?.trim() ||
  path.join(os.tmpdir(), "buildsphere-trivy-cache");
const sourcePattern =
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const revisionPattern = /^(?:unknown|[0-9a-f]{40})$/;
const versionPattern =
  /^(?:development|0|[1-9][0-9]*)(?:\.(?:0|[1-9][0-9]*)){0,2}(?:-[0-9A-Za-z.-]+)?$/;

const run = (command, args, { allowFailure = false } = {}) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) {
    throw result.error;
  }
  if (!allowFailure && result.status !== 0) {
    throw new Error(
      result.stderr || result.stdout || `${command} ${args.join(" ")} failed`,
    );
  }
  return result;
};

const parseJson = (filePath, label) => {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
};

const findingSummary = (report) => {
  let vulnerabilities = 0;
  let secrets = 0;
  for (const result of report.Results ?? []) {
    vulnerabilities += result.Vulnerabilities?.length ?? 0;
    secrets += result.Secrets?.length ?? 0;
  }
  return { vulnerabilities, secrets };
};

assert.equal(catalog.schemaVersion, 1);
assert.equal(catalog.components.length, 11);
assert.equal(new Set(catalog.components.map(({ name }) => name)).size, 11);
run(docker, ["version", "--format", "{{.Server.Version}}"]);
run(trivy, ["--version"]);

const tempRoot = mkdtempSync(
  path.join(os.tmpdir(), "buildsphere-phase13-images-"),
);
let scannedTargets = 0;
let sbomComponents = 0;

try {
  for (const [index, component] of catalog.components.entries()) {
    const reference = `buildsphere/${component.name}:${tag}`;
    process.stdout.write(
      `[${index + 1}/${catalog.components.length}] Inspecting and scanning ${reference}\n`,
    );

    const inspect = JSON.parse(
      run(docker, ["image", "inspect", reference]).stdout,
    );
    assert.equal(
      inspect.length,
      1,
      `${reference} must resolve to one local image`,
    );
    const config = inspect[0].Config;
    const labels = config.Labels ?? {};
    assert.equal(
      labels["org.opencontainers.image.title"],
      `BuildSphere ${component.name}`,
    );
    assert.match(
      labels["org.opencontainers.image.source"] ?? "",
      sourcePattern,
    );
    assert.match(
      labels["org.opencontainers.image.revision"] ?? "",
      revisionPattern,
    );
    assert.match(
      labels["org.opencontainers.image.version"] ?? "",
      versionPattern,
    );
    assert.equal(labels["org.opencontainers.image.licenses"], "MIT");
    assert.equal(config.User, component.type === "frontend" ? "nginx" : "node");

    if (component.type === "backend") {
      run(docker, [
        "run",
        "--rm",
        "--entrypoint",
        "sh",
        reference,
        "-ec",
        [
          "for target in",
          "/usr/local/lib/node_modules/npm",
          "/usr/local/lib/node_modules/corepack",
          "/opt/yarn-v1.22.22",
          "/usr/local/bin/npm",
          "/usr/local/bin/npx",
          "/usr/local/bin/corepack",
          "/usr/local/bin/pnpm",
          "/usr/local/bin/pnpx",
          "/usr/local/bin/yarn",
          "/usr/local/bin/yarnpkg;",
          "do",
          '[ ! -e "$target" ] && [ ! -L "$target" ] || {',
          'echo "runtime package manager remains: $target" >&2;',
          "exit 1;",
          "};",
          "done",
        ].join(" "),
      ]);
    }

    const reportPath = path.join(tempRoot, `${component.name}.trivy.json`);
    const scan = run(
      trivy,
      [
        "image",
        "--cache-dir",
        cacheDir,
        "--quiet",
        "--skip-version-check",
        "--scanners",
        "vuln,secret",
        "--severity",
        "HIGH,CRITICAL",
        "--ignore-unfixed=false",
        "--format",
        "json",
        "--output",
        reportPath,
        "--exit-code",
        "1",
        reference,
      ],
      { allowFailure: true },
    );
    const report = parseJson(reportPath, `${reference} Trivy report`);
    const findings = findingSummary(report);
    if (
      scan.status !== 0 ||
      findings.vulnerabilities > 0 ||
      findings.secrets > 0
    ) {
      throw new Error(
        `${reference} failed the release scan with ${findings.vulnerabilities} HIGH/CRITICAL vulnerabilities and ${findings.secrets} secrets`,
      );
    }
    scannedTargets += report.Results?.length ?? 0;

    const sbomPath = path.join(tempRoot, `${component.name}.cdx.json`);
    run(trivy, [
      "image",
      "--cache-dir",
      cacheDir,
      "--quiet",
      "--skip-version-check",
      "--format",
      "cyclonedx",
      "--output",
      sbomPath,
      reference,
    ]);
    const sbom = parseJson(sbomPath, `${reference} CycloneDX SBOM`);
    assert.equal(sbom.bomFormat, "CycloneDX");
    assert.match(sbom.specVersion ?? "", /^1\.[0-9]+$/);
    assert.equal(sbom.version, 1);
    assert.ok(Array.isArray(sbom.components));
    sbomComponents += sbom.components.length;
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        images: catalog.components.length,
        highOrCriticalVulnerabilities: 0,
        secrets: 0,
        cyclonedxSboms: catalog.components.length,
        scannedTargets,
        sbomComponents,
        runtimePackageManagersRemoved: true,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
