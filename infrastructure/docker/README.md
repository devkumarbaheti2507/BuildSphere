# BuildSphere Container Images

Phase 10 packages BuildSphere itself with two shared Dockerfiles. These files
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
production dependencies, templates, prompts, and SQL migrations. It runs as
the Node image's unprivileged user and sets `BUILDSPHERE_ROOT=/app` so packaged
assets resolve outside the monorepo layout.

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
infrastructure state. CI builds every image without registry login or push.

## Boundaries

Phase 10 does not publish images, select a registry, generate production
credentials, scan or sign images, or deploy to an external cluster. Those
actions require a later release process and explicit operator authority.
