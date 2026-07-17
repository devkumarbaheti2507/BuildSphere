import { createHash } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const catalogPath = path.join(
  repoRoot,
  "infrastructure",
  "release",
  "components.json",
);
const componentCatalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const components = componentCatalog.components;
const componentNames = components.map(({ name }) => name);
const componentNameSet = new Set(componentNames);
const semverPattern =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?$/;
const commitPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const sourceRepositoryPattern =
  /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\/[A-Za-z0-9_.-]+$/;
const repositoryPrefixPattern =
  /^ghcr\.io\/[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?\/buildsphere$/;
const oidcIssuer = "https://token.actions.githubusercontent.com";
const scanPolicy = Object.freeze({
  scanners: ["vuln", "secret"],
  severities: ["HIGH", "CRITICAL"],
  ignoreUnfixed: false,
});
const supportedPlatforms = Object.freeze(["linux/amd64", "linux/arm64"]);

const fail = (message) => {
  throw new Error(message);
};

const writeStdout = (value) => writeFileSync(process.stdout.fd, value, "utf8");
const writeStderr = (value) => writeFileSync(process.stderr.fd, value, "utf8");

const parseOptions = (args) => {
  const options = {};

  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith("--") || value === undefined) {
      fail(`Expected --name value arguments, received: ${args.join(" ")}`);
    }
    const key = name.slice(2);
    if (Object.hasOwn(options, key)) {
      fail(`Option --${key} was provided more than once`);
    }
    options[key] = value;
  }

  return options;
};

const assertOptions = (options, required, command) => {
  const expected = new Set(required);
  for (const key of required) {
    if (!options[key]) {
      fail(`${command} requires --${key}`);
    }
  }
  for (const key of Object.keys(options)) {
    if (!expected.has(key)) {
      fail(`${command} does not accept --${key}`);
    }
  }
};

const assertExactKeys = (value, expectedKeys, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} must contain exactly: ${expected.join(", ")}`);
  }
};

const assertRegularFile = (filePath, label) => {
  let stats;
  try {
    stats = lstatSync(filePath);
  } catch {
    fail(`${label} does not exist: ${filePath}`);
  }
  if (!stats.isFile() || stats.isSymbolicLink()) {
    fail(`${label} must be a regular, non-symlink file: ${filePath}`);
  }
};

const readJson = (filePath, label) => {
  assertRegularFile(filePath, label);
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
};

const writeJson = (filePath, value) => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const sha256File = (filePath) =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

const validateVersion = (version) => {
  if (!semverPattern.test(version)) {
    fail(
      `Release version must be semantic version without build metadata: ${version}`,
    );
  }
  return version;
};

const validateCommit = (commit) => {
  if (!commitPattern.test(commit)) {
    fail(`Source commit must be a full lowercase Git SHA: ${commit}`);
  }
  return commit;
};

const validateDigest = (digest) => {
  if (!digestPattern.test(digest)) {
    fail(`Image digest must match sha256:<64 lowercase hex>: ${digest}`);
  }
  return digest;
};

const validateSourceRepository = (sourceRepository) => {
  if (!sourceRepositoryPattern.test(sourceRepository)) {
    fail(`Source repository must use owner/name form: ${sourceRepository}`);
  }
  return sourceRepository;
};

const validateRepositoryPrefix = (repositoryPrefix) => {
  if (!repositoryPrefixPattern.test(repositoryPrefix)) {
    fail(
      `Repository prefix must use lowercase ghcr.io/<owner>/buildsphere form: ${repositoryPrefix}`,
    );
  }
  return repositoryPrefix;
};

const validateComponent = (component) => {
  if (!componentNameSet.has(component)) {
    fail(`Unknown release component: ${component}`);
  }
  return component;
};

const expectedWorkflowIdentity = (sourceRepository, sourceRef) =>
  `https://github.com/${sourceRepository}/.github/workflows/release.yml@${sourceRef}`;

const validateReleaseIdentity = ({
  version,
  commit,
  sourceRepository,
  sourceRef,
  repositoryPrefix,
  workflowIdentity,
}) => {
  validateVersion(version);
  validateCommit(commit);
  validateSourceRepository(sourceRepository);
  validateRepositoryPrefix(repositoryPrefix);
  if (sourceRef !== `refs/tags/v${version}`) {
    fail(`Source ref must be refs/tags/v${version}: ${sourceRef}`);
  }
  const expectedIdentity = expectedWorkflowIdentity(
    sourceRepository,
    sourceRef,
  );
  if (workflowIdentity !== expectedIdentity) {
    fail(`Workflow identity must be ${expectedIdentity}: ${workflowIdentity}`);
  }
};

const validateSbom = (sbomPath) => {
  const sbom = readJson(sbomPath, "CycloneDX SBOM");
  if (sbom.bomFormat !== "CycloneDX") {
    fail(`SBOM bomFormat must be CycloneDX: ${sbomPath}`);
  }
  if (!/^1\.[0-9]+$/.test(sbom.specVersion ?? "")) {
    fail(`SBOM specVersion must be a CycloneDX 1.x version: ${sbomPath}`);
  }
  if (sbom.version !== 1) {
    fail(`SBOM version must equal 1: ${sbomPath}`);
  }
  if (!Array.isArray(sbom.components)) {
    fail(`SBOM components must be an array: ${sbomPath}`);
  }
};

const validateScanPolicy = (policy, label) => {
  assertExactKeys(
    policy,
    ["scanners", "severities", "ignoreUnfixed"],
    `${label}.scanPolicy`,
  );
  if (JSON.stringify(policy) !== JSON.stringify(scanPolicy)) {
    fail(`${label}.scanPolicy does not match the BuildSphere release policy`);
  }
};

const canonicalPlatformSbomPath = (component, platform) =>
  `sbom/${component}-${platform.replace("/", "-")}.cdx.json`;

const validatePlatforms = (platforms, component, label) => {
  if (!Array.isArray(platforms)) {
    fail(`${label}.platforms must be an array`);
  }
  if (platforms.length !== supportedPlatforms.length) {
    fail(`${label}.platforms must contain exactly the supported platforms`);
  }
  platforms.forEach((platform, index) => {
    assertExactKeys(
      platform,
      ["name", "sbomPath"],
      `${label}.platforms[${index}]`,
    );
    const expectedName = supportedPlatforms[index];
    if (platform.name !== expectedName) {
      fail(`${label}.platforms[${index}].name must be ${expectedName}`);
    }
    const expectedPath = canonicalPlatformSbomPath(component, expectedName);
    if (platform.sbomPath !== expectedPath) {
      fail(`${label}.platforms[${index}].sbomPath must be ${expectedPath}`);
    }
  });
};

const validateRecord = (record, label) => {
  if (record?.schemaVersion === 2) {
    assertExactKeys(
      record,
      [
        "schemaVersion",
        "component",
        "image",
        "digest",
        "version",
        "sourceCommit",
        "platforms",
        "scanPolicy",
      ],
      label,
    );
    validateComponent(record.component);
    validateDigest(record.digest);
    validateVersion(record.version);
    validateCommit(record.sourceCommit);
    validatePlatforms(record.platforms, record.component, label);
    validateScanPolicy(record.scanPolicy, label);
    return record;
  }

  assertExactKeys(
    record,
    [
      "schemaVersion",
      "component",
      "image",
      "digest",
      "version",
      "sourceCommit",
      "sbomPath",
      "scanPolicy",
    ],
    label,
  );
  if (record.schemaVersion !== 1) {
    fail(`${label}.schemaVersion must equal 1`);
  }
  validateComponent(record.component);
  validateDigest(record.digest);
  validateVersion(record.version);
  validateCommit(record.sourceCommit);
  if (record.sbomPath !== `sbom/${record.component}.cdx.json`) {
    fail(`${label}.sbomPath must be the canonical component SBOM path`);
  }
  validateScanPolicy(record.scanPolicy, label);
  return record;
};

const commandMetadata = (options) => {
  assertOptions(
    options,
    ["tag", "commit", "source-repository", "source-ref", "github-output"],
    "metadata",
  );
  const version = options.tag.startsWith("v") ? options.tag.slice(1) : "";
  validateVersion(version);
  validateCommit(options.commit);
  validateSourceRepository(options["source-repository"]);
  if (options["source-ref"] !== `refs/tags/${options.tag}`) {
    fail(`Source ref must match release tag ${options.tag}`);
  }

  const owner = options["source-repository"].split("/", 1)[0].toLowerCase();
  const repositoryPrefix = `ghcr.io/${owner}/buildsphere`;
  validateRepositoryPrefix(repositoryPrefix);
  const workflowIdentity = expectedWorkflowIdentity(
    options["source-repository"],
    options["source-ref"],
  );
  const matrix = {
    include: components.map(({ name: component, type, port }) => ({
      component,
      type,
      port,
    })),
  };
  const outputs = [
    `version=${version}`,
    `repository_prefix=${repositoryPrefix}`,
    `workflow_identity=${workflowIdentity}`,
    `matrix=${JSON.stringify(matrix)}`,
  ];
  appendFileSync(options["github-output"], `${outputs.join("\n")}\n`, "utf8");
  writeStdout(
    `${JSON.stringify({ version, repositoryPrefix, workflowIdentity, components: components.length }, null, 2)}\n`,
  );
};

const commandComponent = (options) => {
  const legacy = Object.hasOwn(options, "sbom");
  const commonOptions = [
    "component",
    "repository-prefix",
    "digest",
    "version",
    "commit",
    "output",
  ];
  assertOptions(
    options,
    legacy
      ? [...commonOptions, "sbom"]
      : [...commonOptions, "sbom-amd64", "sbom-arm64"],
    "component",
  );
  const component = validateComponent(options.component);
  const repositoryPrefix = validateRepositoryPrefix(
    options["repository-prefix"],
  );
  const digest = validateDigest(options.digest);
  const version = validateVersion(options.version);
  const sourceCommit = validateCommit(options.commit);
  let record;
  if (legacy) {
    validateSbom(options.sbom);
    record = {
      schemaVersion: 1,
      component,
      image: `${repositoryPrefix}/${component}`,
      digest,
      version,
      sourceCommit,
      sbomPath: `sbom/${component}.cdx.json`,
      scanPolicy,
    };
  } else {
    validateSbom(options["sbom-amd64"]);
    validateSbom(options["sbom-arm64"]);
    record = {
      schemaVersion: 2,
      component,
      image: `${repositoryPrefix}/${component}`,
      digest,
      version,
      sourceCommit,
      platforms: supportedPlatforms.map((name) => ({
        name,
        sbomPath: canonicalPlatformSbomPath(component, name),
      })),
      scanPolicy,
    };
  }
  writeJson(options.output, record);
  writeStdout(
    `${JSON.stringify({ component, reference: `${record.image}@${digest}` }, null, 2)}\n`,
  );
};

const readComponentRecords = (inputDir) => {
  const recordsDir = path.join(inputDir, "records");
  let entries;
  try {
    entries = readdirSync(recordsDir, { withFileTypes: true });
  } catch {
    fail(`Component records directory does not exist: ${recordsDir}`);
  }
  if (
    entries.some(
      (entry) =>
        !entry.isFile() ||
        entry.isSymbolicLink() ||
        !entry.name.endsWith(".json"),
    )
  ) {
    fail("Component records directory may contain only regular JSON files");
  }

  const byComponent = new Map();
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const record = validateRecord(
      readJson(
        path.join(recordsDir, entry.name),
        `Component record ${entry.name}`,
      ),
      `Component record ${entry.name}`,
    );
    if (byComponent.has(record.component)) {
      fail(`Duplicate component record: ${record.component}`);
    }
    byComponent.set(record.component, record);
  }

  const missing = componentNames.filter((name) => !byComponent.has(name));
  if (missing.length > 0 || byComponent.size !== componentNames.length) {
    fail(
      `Release requires exactly 11 component records; missing: ${missing.join(", ") || "none"}`,
    );
  }
  const records = componentNames.map((name) => byComponent.get(name));
  const schemaVersions = new Set(
    records.map(({ schemaVersion }) => schemaVersion),
  );
  if (schemaVersions.size !== 1) {
    fail("Release component records must all use the same schema version");
  }
  return records;
};

const writeDigestValues = ({
  outputPath,
  repositoryPrefix,
  version,
  records,
}) => {
  const lines = [
    "image:",
    `  repositoryPrefix: ${JSON.stringify(repositoryPrefix)}`,
    `  tag: ${JSON.stringify(version)}`,
    "  digestMode: true",
    "  digests:",
    ...records.map(
      ({ component, digest }) => `    ${component}: ${JSON.stringify(digest)}`,
    ),
    "",
  ];
  writeFileSync(outputPath, lines.join("\n"), "utf8");
};

const commandBundle = (options) => {
  assertOptions(
    options,
    [
      "input-dir",
      "chart",
      "version",
      "commit",
      "repository-prefix",
      "source-repository",
      "source-ref",
      "workflow-identity",
      "output-dir",
    ],
    "bundle",
  );
  const identity = {
    version: options.version,
    commit: options.commit,
    repositoryPrefix: options["repository-prefix"],
    sourceRepository: options["source-repository"],
    sourceRef: options["source-ref"],
    workflowIdentity: options["workflow-identity"],
  };
  validateReleaseIdentity(identity);
  assertRegularFile(options.chart, "Packaged Helm chart");
  const expectedChartName = `buildsphere-${identity.version}.tgz`;
  if (path.basename(options.chart) !== expectedChartName) {
    fail(`Packaged chart must be named ${expectedChartName}`);
  }

  const records = readComponentRecords(options["input-dir"]);
  const outputDir = path.resolve(options["output-dir"]);
  mkdirSync(outputDir, { recursive: true });

  const schemaVersion = records[0].schemaVersion;
  const images = records.map((record) => {
    if (
      record.version !== identity.version ||
      record.sourceCommit !== identity.commit ||
      record.image !== `${identity.repositoryPrefix}/${record.component}`
    ) {
      fail(`Component record identity mismatch: ${record.component}`);
    }
    const image = {
      component: record.component,
      repository: record.image,
      digest: record.digest,
      reference: `${record.image}@${record.digest}`,
    };

    if (schemaVersion === 1) {
      const sourceSbom = path.join(options["input-dir"], record.sbomPath);
      validateSbom(sourceSbom);
      const sbomFile = `buildsphere-${record.component}.cdx.json`;
      const destinationSbom = path.join(outputDir, sbomFile);
      copyFileSync(sourceSbom, destinationSbom);
      image.sbom = {
        file: sbomFile,
        sha256: sha256File(destinationSbom),
      };
      return image;
    }

    image.platforms = record.platforms.map((platform) => {
      const sourceSbom = path.join(options["input-dir"], platform.sbomPath);
      validateSbom(sourceSbom);
      const sbomFile = `buildsphere-${record.component}-${platform.name.replace("/", "-")}.cdx.json`;
      const destinationSbom = path.join(outputDir, sbomFile);
      copyFileSync(sourceSbom, destinationSbom);
      return {
        name: platform.name,
        sbom: {
          file: sbomFile,
          sha256: sha256File(destinationSbom),
        },
      };
    });
    return image;
  });

  const chartDestination = path.join(outputDir, expectedChartName);
  if (path.resolve(options.chart) !== chartDestination) {
    copyFileSync(options.chart, chartDestination);
  }
  const digestValuesFile = "buildsphere-digest-values.yaml";
  const digestValuesPath = path.join(outputDir, digestValuesFile);
  writeDigestValues({
    outputPath: digestValuesPath,
    repositoryPrefix: identity.repositoryPrefix,
    version: identity.version,
    records,
  });

  const manifestFile = "buildsphere-release-manifest.json";
  const manifestPath = path.join(outputDir, manifestFile);
  const manifest = {
    schemaVersion,
    release: {
      name: "BuildSphere",
      version: identity.version,
      sourceRepository: `https://github.com/${identity.sourceRepository}`,
      sourceRef: identity.sourceRef,
      sourceCommit: identity.commit,
    },
    signing: {
      method: "sigstore-keyless",
      workflowIdentity: identity.workflowIdentity,
      oidcIssuer,
    },
    scanPolicy,
    chart: {
      name: "buildsphere",
      version: identity.version,
      file: expectedChartName,
      sha256: sha256File(chartDestination),
      digestValues: {
        file: digestValuesFile,
        sha256: sha256File(digestValuesPath),
      },
    },
    images,
  };
  writeJson(manifestPath, manifest);

  const checksumFiles = [
    expectedChartName,
    digestValuesFile,
    manifestFile,
    ...images.flatMap((image) =>
      schemaVersion === 1
        ? [image.sbom.file]
        : image.platforms.map(({ sbom }) => sbom.file),
    ),
  ].sort();
  const checksums = checksumFiles
    .map((relativePath) => {
      const absolutePath = path.join(outputDir, relativePath);
      assertRegularFile(absolutePath, `Release artifact ${relativePath}`);
      return `${sha256File(absolutePath)}  ${relativePath}`;
    })
    .join("\n");
  writeFileSync(path.join(outputDir, "SHA256SUMS"), `${checksums}\n`, "utf8");

  writeStdout(
    `${JSON.stringify({ version: identity.version, images: images.length, platformSboms: schemaVersion === 2 ? images.length * supportedPlatforms.length : images.length, releaseFiles: checksumFiles.length + 1 }, null, 2)}\n`,
  );
};

const commandReferences = (options) => {
  assertOptions(options, ["manifest"], "references");
  const manifest = readJson(options.manifest, "Release manifest");
  if (
    ![1, 2].includes(manifest.schemaVersion) ||
    !Array.isArray(manifest.images)
  ) {
    fail("Release manifest schema is invalid");
  }
  const names = new Set();
  for (const image of manifest.images) {
    validateComponent(image.component);
    validateDigest(image.digest);
    if (image.reference !== `${image.repository}@${image.digest}`) {
      fail(`Release manifest reference mismatch: ${image.component}`);
    }
    if (manifest.schemaVersion === 2) {
      if (!Array.isArray(image.platforms)) {
        fail(`Release manifest platforms are missing: ${image.component}`);
      }
      if (
        JSON.stringify(image.platforms.map(({ name }) => name)) !==
        JSON.stringify(supportedPlatforms)
      ) {
        fail(`Release manifest platform set is invalid: ${image.component}`);
      }
    }
    if (names.has(image.component)) {
      fail(`Release manifest contains duplicate component: ${image.component}`);
    }
    names.add(image.component);
  }
  const missing = componentNames.filter((name) => !names.has(name));
  if (missing.length > 0 || names.size !== componentNames.length) {
    fail(`Release manifest must contain exactly 11 images`);
  }
  for (const name of componentNames) {
    const image = manifest.images.find(({ component }) => component === name);
    writeStdout(`${image.reference}\n`);
  }
};

const commands = {
  metadata: commandMetadata,
  component: commandComponent,
  bundle: commandBundle,
  references: commandReferences,
};

try {
  if (componentCatalog.schemaVersion !== 1 || components.length !== 11) {
    fail("Release component catalog must contain exactly 11 schema-v1 entries");
  }
  if (componentNameSet.size !== components.length) {
    fail("Release component catalog contains duplicate names");
  }
  const [command, ...args] = process.argv.slice(2);
  const handler = commands[command];
  if (!handler) {
    fail(
      `Usage: create-release-evidence.mjs <${Object.keys(commands).join("|")}> [options]`,
    );
  }
  handler(parseOptions(args));
} catch (error) {
  writeStderr(`Release evidence error: ${error.message}\n`);
  process.exitCode = 1;
}
