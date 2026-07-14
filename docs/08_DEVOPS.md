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
6. Prometheus rule syntax plus observability contract verification.
7. No-push builds for all ten backend images and the frontend image.

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
  migrations, plus all ten backend metric endpoints.
- Internal scrape metadata on backend Services and optional Prometheus Operator
  discovery and alert resources.

The chart does not install PostgreSQL, Redis, MinIO, MailHog, ingress,
cert-manager, a monitoring stack, or a Secret. Operators must create the
namespace and runtime Secret before install because migrations run as a
pre-install hook. `ServiceMonitor` and `PrometheusRule` stay disabled unless an
operator explicitly enables them against existing CRDs.

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

# Production observability baseline

Every backend service exposes an internal `GET /metrics` endpoint with:

- Node.js and process metrics prefixed by `buildsphere_`.
- Request count, duration histogram, and in-flight request metrics.
- A stable service label and bounded method, matched-route, and status labels.
- No raw URL, query, user, project, correlation, or credential labels.

Monitoring Service combines the shared metric families with its existing
aggregate health gauges. `/metrics` requests are excluded from HTTP metrics,
and unmatched requests use one literal route label to avoid leaking identifiers
or creating unbounded series.

The platform chart annotates only backend Services for scraping. Optional
`ServiceMonitor` and `PrometheusRule` resources are disabled by default so the
chart still installs without Prometheus Operator CRDs. When enabled, they
provide service discovery, recording rules, and alerts for service down,
API Gateway server errors, and API Gateway latency. Alert routing and receiver
credentials remain external Alertmanager concerns.

The API Gateway objectives are 99.9% availability over 30 days and 95% of
eligible requests within 750 ms. The versioned Grafana dashboard is at
`infrastructure/observability/grafana/buildsphere-overview.json`; response
procedures are under `docs/runbooks/`.

Validate the complete Phase 11 contract:

```bash
HELM_BIN=/path/to/helm PROMTOOL_BIN=/path/to/promtool pnpm verify:phase11
```

CI requires `promtool` and validates the rendered recording and alert rules.
The existing Phase 10 image smoke now also checks each backend metric endpoint,
and the disposable-cluster Helm test scrapes all ten backend Services.

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

# Observability boundaries

Current:

- Structured JSON request logs and correlation IDs.
- Health endpoints and Kubernetes probes.
- Shared Prometheus runtime and bounded HTTP RED metrics on all ten backends.
- Monitoring Service aggregate health gauges.
- Operator-selectable ServiceMonitor and PrometheusRule resources.
- A versioned Grafana dashboard, API SLOs, and checked-in alert runbooks.

Future production work:

- Operating Prometheus, Grafana, Alertmanager, and their retention/storage.
- Centralized logs and retention.
- Distributed tracing.
- Deployment and infrastructure audit export.

# Environment status

| Environment | Current purpose                                                         |
| ----------- | ----------------------------------------------------------------------- |
| local       | Developer runtime, Docker Compose, image smoke, and disposable kind.    |
| dev         | Shared environment, not yet operated by this repository.                |
| staging     | Chart-ready after external images, database, secrets, ingress, and TLS. |
| production  | Not release-certified; later security and reliability work required.    |

# Phase 10-11 boundaries

Phase 10 creates deployable packaging but does not publish images, operate a
registry, provision a cluster, manage production secrets, configure backups,
install platform dependencies, or deploy externally. Any such action requires
a separately approved release milestone and environment configuration.

Phase 11 defines and validates observability signals but does not install a
monitoring operator, expose metrics through ingress, configure alert receivers,
or contact an external environment.
