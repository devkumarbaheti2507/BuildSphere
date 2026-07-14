# Document Information

| Field             | Value                    |
| ----------------- | ------------------------ |
| Document          | DevOps Plan              |
| Version           | 0.1.0                    |
| Status            | Draft                    |
| Author            | BuildSphere Team         |
| Last Updated      | 2026-07-14               |
| Related Documents | 02_HLD.md, 12_ROADMAP.md |

---

# Purpose

This document defines how BuildSphere itself is built, tested, containerized,
and prepared for controlled deployment. Generated project assets have separate
contracts under `templates/` and `specs/`.

# Local development

Use Node.js 22 and PNPM workspaces:

```bash
corepack enable
pnpm install
pnpm -r build
```

Start local dependencies and apply migrations:

```bash
docker compose -f docker-compose.dev.yml up -d
pnpm db:migrate
```

Start the application:

```bash
pnpm -r --parallel dev
```

# CI for BuildSphere

`.github/workflows/ci.yml` runs:

1. Frozen dependency installation.
2. Zero-warning lint.
3. Production builds.
4. All workspace tests.
5. Helm strict lint and structured chart verification.
6. No-push builds for all ten backend images and the frontend image.

CI has read-only repository contents permission. Phase 10 does not configure a
registry login, image push, signing key, Kubernetes credential, or deployment
job.

# Production container baseline

BuildSphere uses one parameterized backend Dockerfile and one frontend
Dockerfile under `infrastructure/docker/`.

Backend image guarantees:

- Repository-root build context for PNPM `workspace:*` dependencies.
- Fixed allowlist of ten service names.
- Frozen install, dependency-ordered TypeScript build, and production-only
  `pnpm deploy` output.
- Explicit `BUILDSPHERE_ROOT=/app` for templates, prompts, and migrations.
- Non-root runtime user, service-specific port, and `/health` check.
- No `.env`, VCS metadata, source workspace dependencies, caches, or previous
  build output from the host.

Frontend image guarantees:

- Compiled same-origin `/api` base.
- Non-root Nginx on port 8080.
- `/healthz`, SPA fallback, immutable asset caching, and browser security
  headers.
- Read-only-root compatibility through memory-backed `/tmp` paths.

Build and smoke all images locally:

```bash
pnpm verify:phase10:images
```

# BuildSphere Helm release

`infrastructure/helm/buildsphere/` deploys API Gateway, Auth, Project,
Pipeline, Deployment, Monitoring, Logging, AI, Analytics, Notification, and
Frontend.

The chart provides:

- One Deployment and Service per component.
- Dedicated ServiceAccounts with token mounting disabled.
- Non-secret ConfigMap values and one external Secret reference.
- A pre-install/pre-upgrade migration Job.
- Non-root and read-only security contexts, seccomp, dropped capabilities,
  resource requests/limits, probes, graceful termination, and writable `/tmp`.
- Optional host-based ingress with `/api` routed before `/` and an
  operator-owned TLS Secret.
- A Helm test that checks frontend health, API routing, and seven applied
  migrations.

The chart does not install PostgreSQL, Redis, MinIO, MailHog, ingress,
cert-manager, monitoring, or a Secret. Operators must create the namespace and
runtime Secret before install because migrations run as a pre-install hook.

Validate chart structure:

```bash
HELM_BIN=/path/to/helm pnpm verify:phase10
```

Run the complete local install and upgrade gate:

```bash
pnpm verify:phase10:images
KIND_BIN=/path/to/kind HELM_BIN=/path/to/helm pnpm verify:phase10:kind
```

The verifier creates and deletes its own kind cluster. It installs an ephemeral
PostgreSQL fixture and random test-only Secret, runs migration/install/test,
runs migration/upgrade/test again, and leaves no cluster behind.

# Runtime configuration

Production deployments obtain non-secret service URLs and feature policy from
the chart ConfigMap. Credential values come from the external Secret. Required
keys are:

```text
DATABASE_URL
JWT_ACCESS_TOKEN_SECRET
JWT_REFRESH_TOKEN_SECRET
INTERNAL_SERVICE_TOKEN
```

GitHub credentials are optional unless GitHub integration is enabled.
Kubernetes execution remains disabled by default. Enabling it requires the
dedicated encryption key plus non-empty exact API server and environment
allowlists.

# Generated DevOps assets

BuildSphere can generate:

- Dockerfile and Docker Compose source.
- GitHub Actions workflows.
- Raw Kubernetes resources.
- Optional Helm source.
- Optional disabled AWS EKS Terraform source.
- Operator guidance.

Generated Helm charts are source artifacts. Phase 9 executes constrained raw
manifests only and never invokes Helm. Generated Terraform remains limited to
format, backend-disabled initialization, and static validation. BuildSphere
does not run Terraform plan, apply, destroy, import, or state commands.

# Observability

Current:

- Structured JSON request logs.
- Correlation IDs.
- Health endpoints and Kubernetes probes.
- Monitoring Service health aggregation and Prometheus-format metrics.

Future production work:

- Centralized logs and retention.
- Metrics scraping, dashboards, alerts, and SLOs.
- Distributed tracing.
- Deployment and infrastructure audit export.

# Environment status

| Environment | Current purpose                                                         |
| ----------- | ----------------------------------------------------------------------- |
| local       | Developer runtime, Docker Compose, image smoke, and disposable kind.    |
| dev         | Shared environment, not yet operated by this repository.                |
| staging     | Chart-ready after external images, database, secrets, ingress, and TLS. |
| production  | Not release-certified; later security and reliability work required.    |

# Phase 10 boundaries

Phase 10 creates deployable packaging but does not publish images, operate a
registry, provision a cluster, manage production secrets, configure backups,
install platform dependencies, or deploy externally. Any such action requires
a separately approved release milestone and environment configuration.
