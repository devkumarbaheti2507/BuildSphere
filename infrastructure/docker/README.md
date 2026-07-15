# BuildSphere Container Images

Phase 10 packages BuildSphere itself with two shared Dockerfiles, and Phase 13
adds immutable base inputs plus OCI release identity. These files
are separate from the Dockerfiles generated for user projects under
`templates/`.

## Backend images

`Dockerfile.backend` uses the repository root as its build context and accepts
one of the ten checked-in backend service names through `SERVICE`.

```bash
docker build \
  --file infrastructure/docker/Dockerfile.backend \
  --build-arg SERVICE=api-gateway \
  --build-arg SERVICE_PORT=8080 \
  --tag buildsphere/api-gateway:0.1.0 \
  .
```

The build uses PNPM `9.15.0`, a frozen lockfile, the selected workspace
dependency graph, and `pnpm deploy --prod`. The runtime contains built output,
production dependencies, templates, prompts, and SQL migrations. It removes
npm, Corepack, PNPM, and Yarn, runs as the Node image's unprivileged user, and
sets `BUILDSPHERE_ROOT=/app` so packaged assets resolve outside the monorepo
layout.

The Node base uses an exact version and multi-platform manifest digest.
Release builds also pass `BUILD_VERSION`, `BUILD_REVISION`, `BUILD_SOURCE`, and
`BUILD_LICENSES`; only those non-secret values become OCI labels.

## Frontend image

```bash
docker build \
  --file infrastructure/docker/Dockerfile.frontend \
  --build-arg VITE_API_URL=/api \
  --tag buildsphere/frontend:0.1.0 \
  .
```

The browser uses the same origin for `/api`. Nginx runs as its unprivileged
user on port 8080 and exposes `/healthz`.

Both the Node builder and stable Nginx runtime use exact tags plus immutable
manifest digests. Dependabot proposes digest changes for review.

## Local verification

Build all eleven images and start each one with a read-only filesystem,
dropped capabilities, no privilege escalation, and a memory-backed `/tmp`:

```bash
pnpm verify:phase10:images
```

The images are tagged `buildsphere/<component>:phase10-local` by default. Set
`PHASE10_IMAGE_TAG` to use another local tag.

The repository `.dockerignore` and Dockerfile-specific ignore files exclude
`.env`, VCS data, dependencies, prior build output, coverage, caches, and local
infrastructure state. Normal CI builds every image without registry login or
push.

## Boundaries

The separate semantic-tag release workflow can publish to GHCR, scan immutable
digests, attach SBOM/provenance, and sign with GitHub OIDC after protected
environment approval. It creates a draft release and never deploys to an
external cluster. Local Phase 13 verification performs none of those remote
actions.
