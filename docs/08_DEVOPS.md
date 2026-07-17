# Document Information

| Field             | Value                    |
| ----------------- | ------------------------ |
| Document          | DevOps Plan              |
| Version           | 0.1.0                    |
| Status            | Draft                    |
| Author            | BuildSphere Team         |
| Last Updated      | 2026-07-15               |
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
7. Runtime reliability, autoscaling, disruption, and network-policy contract
   verification.
8. Supply-chain workflow, immutable digest, release-evidence, and hostile-input
   verification with checksum-pinned `actionlint`.
9. No-push builds for all ten backend images and the frontend image.

CI has read-only repository contents permission. It does not configure a
registry login, image push, signing key, Kubernetes credential, or deployment
job. Package and OIDC permissions exist only in the semantic-tag release
workflow.

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
- An exact Node version plus immutable base-image digest and OCI source,
  revision, version, and license labels.

Frontend image guarantees:

- Compiled same-origin `/api` base.
- Non-root Nginx on port 8080.
- `/healthz`, SPA fallback, immutable asset caching, and browser security
  headers.
- Read-only-root compatibility through memory-backed `/tmp` paths.
- Exact Node and stable Nginx versions plus immutable base-image digests and
  OCI source identity.

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
- Explicit zero-unavailable rolling updates and soft hostname topology spread.
- Optional PodDisruptionBudgets, `autoscaling/v2` HPAs, and ingress-only
  NetworkPolicies with exact release/component peers.
- Optional fail-closed digest mode covering every Deployment, the migration
  Job, and the chart test.

The chart does not install PostgreSQL, Redis, MinIO, MailHog, ingress,
cert-manager, a monitoring stack, or a Secret. Operators must create the
namespace and runtime Secret before install because migrations run as a
pre-install hook. `ServiceMonitor` and `PrometheusRule` stay disabled unless an
operator explicitly enables them against existing CRDs.
PodDisruptionBudgets, HPAs, and NetworkPolicies are also disabled by default.
PDBs require at least two effective replicas, HPAs require a cluster Metrics
API, and policies require an enforcing network plugin plus selectors matching
the target ingress controller and metrics collector.

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

# Runtime reliability and network security

Every platform Deployment uses `RollingUpdate` with zero unavailable replicas,
one surge replica, a readiness settling period, and soft hostname spreading.
These defaults remain compatible with one-node development clusters.

Optional controls are independently configurable:

- PDBs preserve `minAvailable` during voluntary disruption and fail chart
  validation unless the fixed replica count or HPA minimum can tolerate it.
- HPAs own Deployment scale while enabled, use CPU and memory requests, and
  apply bounded scale-up plus stabilized scale-down behavior.
- Ingress-only NetworkPolicies encode the checked-in service caller graph,
  chart tests, selected public ingress peers, and selected backend metric
  collectors. They do not restrict environment-dependent egress.

Validate the Phase 12 contract and disposable-cluster integration:

```bash
HELM_BIN=/path/to/helm pnpm verify:phase12
KIND_BIN=/path/to/kind HELM_BIN=/path/to/helm pnpm verify:phase12:kind
```

The kind mode uses two fixed replicas and enables PDBs and NetworkPolicies.
HPA runtime scaling stays structural because the fixture intentionally does not
install a Metrics API.

# Software supply-chain release certification

`.github/workflows/release.yml` is separate from normal CI and runs only for a
semantic-version tag whose commit belongs to the default branch. Image and
certification jobs use the `production-release` GitHub environment so
operators can configure reviewer protection.

The workflow builds all eleven images as AMD64/ARM64 OCI indexes with BuildKit
SBOM and maximal provenance attestations. It scans each immutable platform with
checksum-pinned Trivy, writes 22 CycloneDX SBOMs, and signs accepted index
digests keylessly with Cosign and GitHub OIDC only after both scans pass. It
then verifies all signatures, packages the chart, generates a digest-only
values file, signs the canonical manifest and checksums, and creates a draft
GitHub Release. It does not deploy or publish the draft.

All checked-in action references use full commit SHAs. Dependabot proposes
reviewed updates for GitHub Actions, PNPM dependencies, and Docker base images.
Validate the local contract with:

```bash
HELM_BIN=/path/to/helm ACTIONLINT_BIN=/path/to/actionlint pnpm verify:phase13
KIND_BIN=/path/to/kind HELM_BIN=/path/to/helm pnpm verify:phase13:kind
```

The Phase 13 kind mode installs all application, migration, and chart-test
containers by exact local manifest digest while retaining the Phase 12
two-replica, disruption-budget, and network-policy checks.

The complete operator and verification procedure is in
`docs/17_RELEASE_CERTIFICATION.md`.

# Personal free-tier deployment profile

`infrastructure/helm/buildsphere-personal-prerequisites` is a separate release
that owns one PostgreSQL StatefulSet, retained storage, an internal Service,
database ingress policy, an authenticated Helm test, and optional namespaced
cert-manager resources. It renders no Secret and does not change the main
chart's external database contract.

`infrastructure/deployment/free-tier` provides a one-replica Traefik overlay
for a resource-constrained K3s host. Generate its two Secrets only through the
context-confirmed bootstrap, then combine certified digest values before the
personal application values.

Validate the complete local contract with:

```bash
HELM_BIN=/path/to/helm pnpm verify:phase14
pnpm verify:phase14:arm64
KIND_BIN=/path/to/kind HELM_BIN=/path/to/helm pnpm verify:phase14:kind
```

These checks do not create an account, provision a server, request a public
certificate, push an image, or mutate an external cluster.

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

| Environment | Current purpose                                                            |
| ----------- | -------------------------------------------------------------------------- |
| local       | Developer runtime, Docker Compose, image smoke, and disposable kind.       |
| dev         | Shared environment, not yet operated by this repository.                   |
| personal    | Repository-ready for an operator-led single-node K3s installation.         |
| staging     | Chart-ready after external images, database, secrets, ingress, and TLS.     |
| production  | Build-time certification is ready; external staging certification remains.  |

# Phase 10-14 boundaries

Phase 10 creates deployable packaging but does not publish images, operate a
registry, provision a cluster, manage production secrets, configure backups,
install platform dependencies, or deploy externally. Any such action requires
a separately approved release milestone and environment configuration.

Phase 11 defines and validates observability signals but does not install a
monitoring operator, expose metrics through ingress, configure alert receivers,
or contact an external environment.

Phase 12 defines rollout, disruption, scaling, and ingress-isolation resources
but does not install a Metrics API, CNI policy engine, ingress controller, or
metrics collector. Egress policy, capacity/load tuning, and external
environment certification remain separate work.

Phase 13 defines an authorized publication and build-time certification path.
Local verification performs no registry mutation or signing. A live tag run can
publish signed GHCR digests and a draft release, but final publication and
external staging/production deployment remain separate human approvals.

Phase 14 prepares a single-node installation but does not create a cloud
account, host, firewall, DNS record, certificate controller, public
certificate, backup destination, or production operating commitment. Those
remain explicit operator actions.
