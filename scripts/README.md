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

Exercises the complete MVP workflow through `http://localhost:8080/api`. Run it with `npm run smoke` after the services are available. It is suitable for PostgreSQL-backed verification or the explicitly non-durable `STORAGE_DRIVER=memory` mode.

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
