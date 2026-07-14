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
for health; asserts each image declares a non-root user; and removes all test
containers. Run both through `pnpm verify:phase10:images`.

## `verify-phase10-kind.sh`

Creates and deletes its own uniquely named kind cluster. It builds a
single-platform PostgreSQL fixture from a pinned upstream digest, loads all 11
BuildSphere images, generates random test-only runtime credentials, installs
PostgreSQL, installs and tests BuildSphere, upgrades and tests it again, prints
release history, and cleans temporary files and the cluster. Set exact
`KIND_BIN` and `HELM_BIN` paths when the tools are not on `PATH`, then run
`pnpm verify:phase10:kind`.

The script never pushes images or contacts an external Kubernetes cluster.
