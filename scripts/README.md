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
2. Use `corepack enable` when Corepack is available.
3. Fall back to `npm exec --yes pnpm@9.15.0`.

When npm has previously cached the pinned PNPM package inside `.cache/npm`, the script reuses that exact cached version before requesting the registry. This keeps workspace commands available during a temporary registry outage.

This keeps Makefile and verification commands consistent across machines.

When the script falls back to npm, it uses `.cache/npm` inside the repository. The folder is ignored by Git and avoids failures caused by broken or root-owned files in a user's global npm cache.

## `verify-workspace.sh`

Runs the Phase 1 workspace verification sequence:

```bash
pnpm install --frozen-lockfile=false
pnpm -r build
pnpm -r test
```

## `smoke-mvp.ts`

Exercises the complete MVP workflow through `http://localhost:8080/api`. Run it with `npm run smoke` after the services are available. It is suitable for PostgreSQL-backed verification or the explicitly non-durable `STORAGE_DRIVER=memory` mode.
