# Scripts

Utility scripts for development and automation.

Scripts should be safe to run locally and documented before use.

## `check-toolchain.sh`

Checks the local Node and package-manager setup before workspace verification.

The script warns when the active Node major version does not match `.nvmrc`. It does not fail the build, because the project may still compile on a newer local Node version.

## `pnpm-workspace.sh`

Runs the pinned BuildSphere PNPM version.

Resolution order:

1. Use an installed `pnpm` binary.
2. Run the pinned PNPM version through `corepack pnpm` when Corepack is available.
3. Reuse the exact pinned PNPM version from the project-local npm cache.
4. Fall back to `npm exec --yes pnpm@9.15.0`.

When npm has previously cached the pinned PNPM package inside `.cache/npm`, the script reuses that exact cached version before requesting the registry. This keeps workspace commands available during a temporary registry outage.

This keeps Makefile and verification commands consistent across machines.

When the script falls back to npm, it uses `.cache/npm` inside the repository. The folder is ignored by Git and avoids failures caused by broken or root-owned files in a user's global npm cache.

## `verify-workspace.sh`

Runs the complete workspace verification sequence:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm -r build
pnpm -r test
```

## `smoke-mvp.ts`

Exercises the complete workflow through `http://localhost:8080/api`. In
addition to the Phase 0-8 baseline, it inspects a synthetic kubeconfig, verifies
that credentials are absent from responses and target storage, and builds a
four-resource offline Kubernetes plan with no cluster request. Run it with
`npm run smoke` after the services are available. It is suitable for
PostgreSQL-backed verification or the explicitly non-durable
`STORAGE_DRIVER=memory` mode.

## `verify-phase9-postgres.ts`

Validates encrypted Kubernetes credential storage, expiring approvals, durable
operations, exact and simultaneous idempotency replay, previous-release
resolution, and cleanup against PostgreSQL without contacting a cluster. Run it with
`npm run smoke:phase9:postgres` after applying migrations.

## `verify-phase9-kind.ts`

Runs the real Deployment Service approval, official-client apply, status,
rollback, prune, history, and credential-revocation workflow against an
explicit disposable kind kubeconfig. It does not create or delete a cluster.
Set `KUBECONFIG_PATH` when the kubeconfig is not at
`/tmp/buildsphere-phase9-kubeconfig`, then run
`npm run verify:phase9:kind`.

## `verify-terraform-template.ts`

Renders the AWS EKS Terraform files through the real template catalog into a
temporary directory, checks the artifact safety contract, and runs only:

```bash
terraform fmt -check -recursive
terraform init -backend=false -input=false -no-color
terraform validate -no-color
```

Run `npm run verify:terraform` when `terraform` is available, or provide an
explicit checksum-verified binary with `TERRAFORM_BIN=/path/to/terraform`. The
script does not run plan, apply, destroy, state, or AWS commands.

## `verify-phase10-packaging.mjs`

Runs Helm strict lint, parses the BuildSphere chart as structured YAML, and
checks exact workload counts, zero rendered Secrets, migration and test hooks,
pod security, resources, probes, ingress routing, image-tag policy, execution
defaults, Dockerfile invariants, and Nginx behavior. Set `HELM_BIN` when Helm is
not on `PATH`, then run `pnpm verify:phase10`.

## `verify-phase10-images.sh` and `smoke-phase10-images.sh`

Build all ten backend images plus the frontend image with the local
`phase10-local` tag. The smoke script starts every image with a read-only root,
memory-backed `/tmp`, dropped capabilities, and no privilege escalation; waits
for health; asserts each image declares a non-root user; verifies every backend
`/metrics` response and service label; and removes all test containers. Run
both through `pnpm verify:phase10:images`.

## `verify-phase10-kind.sh`

Creates and deletes its own uniquely named kind cluster. It builds a
single-platform PostgreSQL fixture from a pinned upstream digest, loads all 11
BuildSphere images, generates random test-only runtime credentials, installs
PostgreSQL, installs and tests BuildSphere, upgrades and tests it again, prints
release history, and cleans temporary files and the cluster. Set exact
`KIND_BIN` and `HELM_BIN` paths when the tools are not on `PATH`, then run
`pnpm verify:phase10:kind`.

The script never pushes images or contacts an external Kubernetes cluster.
Set `BUILDSPHERE_PHASE12_RELIABILITY=true`, or run
`pnpm verify:phase12:kind`, to install two replicas of every application plus
the Phase 12 PodDisruptionBudgets and NetworkPolicies during the same
install/test/upgrade/test lifecycle. Horizontal autoscaling remains a
structural test because the disposable cluster does not install a Metrics API.
Set `BUILDSPHERE_PHASE13_DIGEST_MODE=true`, or run
`pnpm verify:phase13:kind`, to combine the reliability controls with exact
local `repository@sha256` references for every application, migration, and
chart-test container. Because kind imports local images under tag names, this
mode registers equivalent digest-qualified aliases in the disposable node's
containerd image store before Helm installation.

## `verify-phase11-observability.mjs`

Runs Helm strict lint and verifies the complete Phase 11 observability
contract: default no-CRD rendering, backend discovery labels and annotations,
opt-in ServiceMonitor and PrometheusRule structure, six recording rules, three
alerts, SLO values, runbook links, dashboard layout and queries, bounded metric
wiring, all ten chart-test scrape targets, and negative values-schema cases.

Run it with:

```bash
HELM_BIN=/path/to/helm PROMTOOL_BIN=/path/to/promtool pnpm verify:phase11
```

`PROMTOOL_BIN` is optional for a local structural check and mandatory when
`CI=true`. The verifier creates only temporary rendered files and does not
contact a cluster or monitoring server.

## `verify-phase12-reliability.mjs`

Runs Helm strict lint and verifies the complete Phase 12 chart contract:
zero-unavailable rollout, soft selector-matched topology spreading, opt-in PDB
replica safety, HPA ownership and behavior, and the exact ingress-only service
caller graph. It also checks custom external selectors, destination ports,
default resource compatibility, zero Secrets, and negative schema/render
cases.

Run it with:

```bash
HELM_BIN=/path/to/helm pnpm verify:phase12
```

The verifier renders manifests locally and never contacts a Kubernetes
cluster. Use the disposable Phase 10 kind gate for runtime install and upgrade
coverage.

## `create-release-evidence.mjs`

Implements the data-only core of Phase 13 release certification:

- `metadata` validates a semantic tag and writes the canonical build matrix.
- `component` validates one image digest and CycloneDX SBOM.
- `bundle` requires all eleven components and emits the release manifest,
  digest-only Helm values, copied SBOM set, and `SHA256SUMS`.
- `references` emits the exact digest references for Cosign verification.

The tool accepts no credential or signing key and performs no network request.

## `install-trivy.sh` and `install-actionlint.sh`

Download the explicitly versioned Linux AMD64 release archives for Trivy and
actionlint, verify checked-in SHA-256 values before extraction, and install only
the expected binary. CI uses actionlint for workflow semantics; the tag release
uses Trivy for immutable-image vulnerability and secret scanning.

## `verify-phase13-supply-chain.mjs`

Runs Helm strict lint and validates default tag mode, complete digest mode,
eleven image references, migration/test digest reuse, Docker OCI metadata,
digest-pinned bases, least-privilege workflows, immutable action pins,
Dependabot configuration, and pinned scanner installers. It also creates a
complete local eleven-component evidence bundle twice, verifies every checksum,
and rejects missing, duplicate, unknown, mismatched, malformed-digest, and
invalid-SBOM fixtures.

```bash
HELM_BIN=/path/to/helm ACTIONLINT_BIN=/path/to/actionlint pnpm verify:phase13
```

The verifier creates temporary local files only. It does not push an image,
request GitHub OIDC, sign an artifact, create a release, or contact a cluster.

## `verify-phase13-images.mjs`

Inspects the eleven locally built BuildSphere images, validates their OCI
labels and non-root runtime users, and confirms that backend runtime images do
not retain npm, Corepack, PNPM, or Yarn tooling. It then applies the same
HIGH/CRITICAL vulnerability and secret policy used by the release workflow and
generates and validates one CycloneDX SBOM per image.

```bash
TRIVY_BIN=/path/to/trivy pnpm verify:phase13:images
```

The command expects the default `phase10-local` image tag. Override it with
`PHASE13_IMAGE_TAG`; use `TRIVY_CACHE_DIR` to reuse a downloaded vulnerability
database. The scanner is read-only with respect to registries and deletes its
temporary reports and SBOMs.
