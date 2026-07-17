# Document Information

| Field             | Value              |
| ----------------- | ------------------ |
| Document          | Low Level Design   |
| Version           | 0.1.0              |
| Status            | Draft              |
| Author            | BuildSphere Team   |
| Last Updated      | 2026-07-11         |
| Related Documents | 02_HLD.md, specs/* |

---

# Purpose

This document defines the low-level service design for BuildSphere.

# Shared service standards

Every backend service must provide:

- `GET /health`
- Structured JSON logs.
- Environment-based configuration.
- Consistent error format.
- Unit tests for business logic.

Standard error response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Project name is required",
    "details": {}
  }
}
```

# API Gateway

Responsibilities:

- Receive frontend API requests.
- Validate authentication token when needed.
- Route requests to backend services.
- Add correlation ID.
- Normalize error responses.

Initial routes:

- `/api/auth/*` -> Auth Service
- `/api/projects/*` -> Project Service
- `/api/pipelines/*` -> Pipeline Service
- `/api/deployments/*` -> Deployment Service
- `/api/suggestions/*` -> AI Service

# Auth Service

Responsibilities:

- User registration.
- Password hashing.
- Login.
- JWT issuing.
- Token refresh.
- Current user profile.
- GitHub App OAuth authorization and callback handling.
- GitHub identity linking and encrypted provider-token persistence.
- GitHub user-token refresh.
- GitHub repository creation and generated-file publishing.
- GitHub Actions run synchronization.

Core modules:

- `AuthController`
- `AuthService`
- `UserRepository`
- `TokenService`
- `PasswordService`
- `GitHubOAuthService`
- `GitHubOAuthClient`
- `ProviderTokenCipher`
- `GitHubIntegrationService`
- `GitHubApiClient`

## Sequence: GitHub login

```text
Frontend -> Auth Service: GET /auth/providers
Frontend: generate PKCE verifier and challenge
Frontend -> Auth Service: POST /auth/github/authorize
Auth Service -> Frontend: signed state and GitHub authorization URL
Frontend -> GitHub: redirect user to authorization URL
GitHub -> Frontend: callback with code and state
Frontend -> Auth Service: POST /auth/github/callback with code, state, verifier
Auth Service -> GitHub: exchange code using client secret and verifier
Auth Service -> GitHub API: fetch user and verified email
Auth Service -> PostgreSQL: create/link identity and store encrypted tokens
Auth Service -> Frontend: BuildSphere access and refresh token session
```

## Sequence: publish generated files to GitHub

```text
Frontend -> Project Service: POST /projects/{id}/github/repository
Project Service -> PostgreSQL: verify owner and load latest artifact
Project Service -> Auth Service: internal publish request with generated files
Auth Service -> PostgreSQL: load connected GitHub identity
Auth Service -> GitHub: refresh expired user token when needed
Auth Service -> GitHub: create repository unless already linked
Auth Service -> GitHub: create or update generated files serially
Auth Service -> PostgreSQL: store repository link and publish result
Auth Service -> Project Service -> Frontend: repository summary
```

## Sequence: synchronize GitHub Actions

```text
Frontend -> Project Service: POST /projects/{id}/github/actions/sync
Project Service -> Auth Service: internal owner-scoped sync request
Auth Service -> GitHub: list repository workflow runs
Auth Service -> PostgreSQL: upsert runs by stable GitHub run ID
Auth Service -> Project Service -> Frontend: synchronized run summaries
```

# Project Service

Responsibilities:

- Project CRUD.
- Tool selections.
- Cross-tool dependency validation.
- Selection-aware template resolution.
- Kubernetes and optional Helm asset generation.
- Optional Terraform AWS EKS source generation.
- Generated artifact metadata.
- Project ownership validation.

Core modules:

- `ProjectController`
- `ProjectService`
- `ToolSelectionService`
- `TemplateCatalogService`
- `ProjectRepository`

# Pipeline Service

Responsibilities:

- Pipeline definitions.
- Pipeline stages.
- Pipeline execution records.
- Status transitions.

Valid execution statuses:

```text
queued -> running -> succeeded
queued -> running -> failed
queued -> cancelled
running -> cancelled
```

Core modules:

- `PipelineController`
- `PipelineDefinitionService`
- `PipelineExecutionService`
- `StageService`
- `PipelineRepository`

# Deployment Service

Responsibilities:

- Deployment targets.
- Kubernetes manifest generation metadata.
- Environment definitions.
- Deployment status records.
- Ephemeral kubeconfig inspection.
- Redacted Kubernetes connection summaries.
- Ordered, non-executing deployment plans.
- Encrypted selected-context credential retention.
- Expiring single-use deployment and rollback approvals.
- Idempotent Kubernetes apply operations.
- Owned-resource status observation and bounded rollback.

Core modules:

- `KubeconfigInspector`
- `KubernetesCredentialCipher`
- `DeploymentPlanner`
- `DeploymentExecutionPolicy`
- `KubernetesExecutor`
- `DeploymentOperationService`
- `ProjectArtifactProvider`
- `DeploymentRepository`

Phase 9 BS-801 accepts kubeconfig text only in request memory. Target
configuration stores `connectionStatus` and a redacted summary; it never stores
the source kubeconfig or credential material. A deployment plan requires an
inspected target and valid rendered manifests, but it does not contact a
cluster.

## Sequence: inspect a Kubernetes target and build a plan

```text
Frontend -> Deployment Service: POST /deployments/kubernetes/inspect with kubeconfig
Deployment Service -> Kubernetes client library: parse and resolve current context
Deployment Service -> Frontend: redacted connection summary and warnings
Frontend -> Deployment Service: POST /deployments/targets with kubeconfig
Deployment Service -> PostgreSQL: store target plus redacted summary only
Frontend -> Deployment Service: POST /deployments/plans with target and rendered manifests
Deployment Service: structurally validate and parse resource identities
Deployment Service -> Frontend: ordered plan marked executable=false
```

## Sequence: connect and execute an approved artifact

```text
Frontend -> Deployment Service: PUT target credential with explicit retention confirmation
Deployment Service: minimize selected kubeconfig and enforce host/TLS/auth policy
Deployment Service: encrypt with owner/target authenticated data
Deployment Service -> PostgreSQL: store ciphertext separately and mark target connected
Frontend -> Deployment Service: POST apply approval with target and artifact IDs
Deployment Service -> Project Service: load immutable artifact with user authorization
Deployment Service: validate executable resource set and hash exact manifests
Deployment Service -> PostgreSQL: store five-minute pending approval
Frontend -> Deployment Service: POST operation with approval and idempotency key
Deployment Service -> PostgreSQL: atomically consume approval and create operation
Deployment Service -> Kubernetes API: ownership prechecks and bounded apply requests
Deployment Service -> PostgreSQL: persist resource results and final status
Deployment Service -> Notification Service: publish safe completion event
```

## Sequence: observe and roll back

```text
Frontend -> Deployment Service: POST operation status refresh
Deployment Service -> Kubernetes API: read only approved operation resources
Deployment Service -> PostgreSQL: persist summarized rollout observations
Frontend -> Deployment Service: POST rollback approval for a successful operation
Deployment Service: resolve the immediately prior successful apply snapshot
Frontend -> Deployment Service: POST rollback with approval and idempotency key
Deployment Service -> Kubernetes API: reapply prior snapshot
Deployment Service -> Kubernetes API: delete only newly introduced, namespaced, ownership-matched resources
Deployment Service -> PostgreSQL: persist rollback audit and resource outcomes
```

BS-801 inspection and planning remain non-executing. BS-802/BS-803 execution
is unavailable unless runtime policy is complete, supports development targets
by default, and never runs Terraform or Helm.

# Phase 10 production packaging

Phase 10 packages BuildSphere itself rather than changing generated project
artifacts.

Container modules:

- `infrastructure/docker/Dockerfile.backend` builds one selected workspace
  service and its workspace dependencies, then creates a production-only
  deploy directory.
- `infrastructure/docker/Dockerfile.frontend` compiles the Vite application
  with `VITE_API_URL=/api` and serves it from a non-root web runtime.
- `BUILDSPHERE_ROOT` points flattened service images to packaged templates,
  prompts, and SQL migrations without depending on the monorepo directory
  depth.

Helm modules:

- A shared ConfigMap contains only non-secret service URLs and feature flags.
- An operator-created Secret supplies `DATABASE_URL`, JWT secrets, the internal
  service token, and optional provider or Kubernetes encryption values.
- One Deployment and ClusterIP Service are rendered for each backend plus the
  frontend.
- A pre-install/pre-upgrade Job runs the existing advisory-locked migration
  runner.
- Optional ingress routes `/api` to API Gateway and `/` to the frontend.
- Pod security contexts, health probes, termination grace periods, and resource
  bounds are applied consistently.

## Sequence: package and deploy BuildSphere

```text
CI -> PNPM: frozen install, lint, build, and test
CI -> Docker: build selected backend and frontend images without push
CI -> Helm: lint and render chart with safe defaults
Operator -> Registry: publish reviewed immutable image tags
Operator -> Kubernetes: create runtime Secret out of band
Operator -> Helm: install or upgrade the BuildSphere chart
Helm hook -> PostgreSQL: run idempotent migrations
Kubernetes -> Workloads: start and check /health or /healthz probes
Ingress -> Frontend/API Gateway: route one public origin
```

Phase 10 does not provision PostgreSQL, a registry, DNS, certificates, cloud
infrastructure, or external secrets. Those remain operator prerequisites and
later production-hardening work.

# Phase 11 production observability

Service Core creates one `prom-client` registry per Express application. The
registry collects prefixed Node.js/process metrics and these shared HTTP
metrics:

- `buildsphere_http_requests_total`
- `buildsphere_http_request_duration_seconds`
- `buildsphere_http_requests_in_flight`

The `service` label is constant for one application. Request labels are limited
to method, matched Express route template, and response status. Unmatched
requests use the literal route `unmatched`; raw request paths and query values
are never metric labels. Scrapes of `/metrics` are excluded from request
metrics so collection does not create self-referential traffic.

Every service registers the shared middleware before application routes and
serves the registry through `GET /metrics`. Monitoring Service appends its
existing `buildsphere_service_up` and health-response gauges to the same
response after performing bounded health checks.

Helm observability modules:

- Backend Services carry an explicit metrics capability label and optional
  standard scrape annotations.
- An optional `ServiceMonitor` selects only those backend Services and scrapes
  the named `http` port at `/metrics`.
- An optional `PrometheusRule` defines BuildSphere recording rules and alerts
  for service down, API Gateway server-error budget consumption, and latency.
- Operator CRDs remain optional and disabled by default; enabling their
  resources requires an existing Prometheus Operator installation.
- The versioned Grafana dashboard and Markdown runbooks are static operator
  assets and contain no credentials or provider configuration.

## Sequence: collect and use service metrics

```text
Express middleware -> Isolated registry: increment in-flight request count
Express response finish -> Isolated registry: count status and observe duration
Prometheus -> Service /metrics: scrape bounded metric families
Prometheus -> PrometheusRule: evaluate recording and alerting expressions
Grafana -> Prometheus: render BuildSphere overview dashboard
Alert receiver -> Runbook: diagnose service, dependency, error, or latency issue
```

# Phase 12 runtime reliability and network security

Every application Deployment declares `RollingUpdate` with zero unavailable
replicas, one surge replica by default, and a readiness settling period. A soft
`kubernetes.io/hostname` topology spread constraint uses the same immutable
selector labels as the Deployment. The soft constraint preserves local
single-node installation while distributing replicas when nodes are
available.

Optional reliability modules:

- One `policy/v1` PodDisruptionBudget per application Deployment uses the
  exact workload selector. Chart validation requires at least two effective
  minimum replicas and requires `minAvailable` to remain below that count.
- One `autoscaling/v2` HorizontalPodAutoscaler per application Deployment uses
  CPU and memory utilization targets. When enabled, the Deployment omits
  `spec.replicas`; Helm no longer competes with the autoscaler for scale.
- HPA scale-up is responsive and scale-down uses a stabilization window plus a
  bounded percentage policy. The Kubernetes Metrics API is an external
  prerequisite and is not installed by the chart.

Optional network module:

- One ingress-only NetworkPolicy selects each application component.
- Same-namespace callers must match the chart name, release instance, and
  reviewed source component.
- The Helm chart-test component can reach every application workload.
- Configurable namespace and pod selectors admit an ingress controller only to
  Frontend and API Gateway, and a metrics collector only to backend services.
- Rules expose only the selected destination's named HTTP port. No `ipBlock`,
  unrestricted peer, or egress policy is rendered.

## Sequence: schedule, scale, and admit traffic

```text
Helm -> Kubernetes API: create Deployment with rollout and topology controls
Helm -> Kubernetes API: optionally create matching PDB, HPA, and NetworkPolicy
Scheduler -> Nodes: spread replicas when topology permits
Eviction API -> PDB: preserve the configured minimum availability
Metrics API -> HPA: report CPU and memory utilization
HPA -> Deployment scale: adjust desired replicas without Helm ownership conflict
Network plugin -> Destination pod: admit only a reviewed ingress peer and port
```

Phase 12 does not restrict egress, install cluster add-ons, create credentials,
or change generated customer project charts.

# Phase 13 software supply-chain release certification

Phase 13 applies to BuildSphere's own eleven production images and Helm chart.
It does not change generated customer project images or run a deployment.

Container metadata modules:

- Both runtime Dockerfiles accept `BUILD_VERSION`, `BUILD_REVISION`,
  `BUILD_SOURCE`, and `BUILD_LICENSES` arguments and expose the corresponding
  OCI labels.
- Release builds use the exact tag commit and never pass credentials as build
  arguments or persist them in image layers.
- A pinned, checksum-verified Trivy binary scans immutable image digests and
  emits one CycloneDX SBOM per component.

Release evidence modules:

- A component-record command validates component identity, image repository,
  `sha256` digest, semantic version, source commit, and CycloneDX SBOM.
- A bundle command requires exactly the ten backend components plus Frontend,
  verifies every record against one release identity, hashes each SBOM and the
  packaged chart, and emits a canonical JSON release manifest.
- The same command emits a Helm values overlay containing the repository
  prefix and all eleven image digests.
- The release workflow signs image digests and release files with Cosign using
  the short-lived GitHub Actions OIDC identity. No long-lived signing key is
  stored in the repository or GitHub Secrets.

Helm image resolution:

- Tag mode remains the default for local development and existing no-push CI.
- Digest mode is explicit and requires one valid `sha256` digest for every
  application component.
- All Deployments, the migration Job, and the Helm test use the same image
  resolver, so digest mode cannot silently fall back to a tag.

## Sequence: certify a BuildSphere release candidate

```text
Git tag -> Release workflow: validate semantic version and default-branch ancestry
Release workflow -> Protected environment: wait for configured reviewer approval
BuildKit -> GHCR: publish component image plus SBOM/provenance attestations
Trivy -> Image digest: scan and write CycloneDX SBOM
Cosign -> Image digest: create keyless signature after the scan passes
Matrix job -> Artifact store: upload signed component record and SBOM
Certification job -> Cosign: verify all image signatures against workflow identity
Certification job -> Helm: package the chart for the release version
Evidence tool -> Release directory: write manifest, digest values, and checksums
Cosign -> Release directory: sign manifest and checksums as keyless blobs
GitHub CLI -> Draft release: upload the complete candidate for operator review
```

Phase 13 verification exercises evidence generation with deterministic local
fixtures, validates the workflow and all pinned actions structurally, renders
the chart in tag and digest modes, and rebuilds/runs the production images. It
does not push to GHCR, request an OIDC certificate, create a GitHub Release, or
deploy to an external environment.

# Phase 14 personal free-tier deployment readiness

Phase 14 preserves the Phase 10 application chart boundary while adding the
smallest operator-owned prerequisites needed by a single-node K3s deployment.

Release platform modules:

- Buildx creates one OCI index per component for exactly `linux/amd64` and
  `linux/arm64` after QEMU setup through a full-SHA-pinned action.
- Trivy scans each immutable platform selection independently and writes one
  CycloneDX SBOM per component and platform.
- Evidence schema 2 requires the exact ordered platform set, while schema 1
  remains readable only for frozen Phase 13 regression fixtures.
- The bundle contains 22 SBOMs and binds them to the eleven index digests.

Personal prerequisite modules:

- A separate `buildsphere-personal-prerequisites` Helm chart installs one
  PostgreSQL StatefulSet, retained PVC, internal Service, ingress-only
  NetworkPolicy, and database readiness test.
- The chart references an existing database Secret and never renders Secret
  material. Optional cert-manager resources are namespaced and disabled by
  default.
- A shell bootstrap requires an exact kube-context confirmation, refuses to
  overwrite either Secret, generates values in memory, and sends them directly
  to Kubernetes without printing them or writing a credential file.
- The checked-in application overlay uses Traefik ingress and one replica and
  leaves autoscaling, disruption budgets, monitoring CRDs, application network
  policies, and controlled deployment execution disabled.

## Sequence: prepare a personal K3s installation

```text
Operator -> kubectl: confirm the exact current context
Bootstrap -> Kubernetes API: create namespace and two generated Secrets
Helm -> Prerequisite chart: install PostgreSQL and retained storage
Helm test -> PostgreSQL Service: verify authenticated readiness
Operator -> cert-manager: install the external controller when TLS is desired
Helm -> Prerequisite chart: optionally create Issuer and Certificate
Helm -> Main chart: merge certified digest values with personal values
Migration Job -> PostgreSQL: apply the seven idempotent migrations
Helm test -> API Gateway: verify the deployed application
```

Local verification uses structural renders, deterministic evidence fixtures,
representative ARM64 cross-builds, and a disposable kind cluster. It does not
provision or mutate a personal cloud server.

# Logging Service

Responsibilities:

- Store pipeline logs.
- Return logs by pipeline execution.
- Support future streaming.

MVP can store logs in PostgreSQL or append-only files. Future versions may use OpenSearch or Loki.

# AI Service

Responsibilities:

- Load prompts from `prompts/`.
- Run rule-based analysis.
- Optionally call LLM provider.
- Return structured suggestions.

Suggestion shape:

```json
{
  "category": "docker",
  "severity": "medium",
  "title": "Use a smaller base image",
  "description": "The generated Dockerfile can use an Alpine or distroless image.",
  "recommendedAction": "Update Dockerfile base image after testing compatibility."
}
```

# Notification Service

Responsibilities:

- Store notifications.
- Mark notifications read/unread.
- Future email or Slack integration.

Frontend behavior:

- The application shell opens a notification drawer from the unread counter.
- The drawer shows complete event content and supports individual and bulk read
  actions.
- Bulk read reuses the idempotent per-notification read API; Phase 8 does not
  add a separate batch endpoint.
- Dashboard notification previews expose the same individual read action and
  update shared application state.

# Analytics Service

Responsibilities:

- Track product usage events.
- Generate dashboard metrics.
- Support future recommendation analytics.

# Monitoring Service

Responsibilities:

- Aggregate service health.
- Expose aggregate health, runtime, and HTTP metrics on `/metrics`.
- Provide dashboard-ready data.

# Sequence: create project

```text
Frontend -> API Gateway: POST /api/projects
API Gateway -> Auth Service: validate token
API Gateway -> Project Service: create project
Project Service -> PostgreSQL: save project
Project Service -> Pipeline Service: create default pipeline definition
Pipeline Service -> PostgreSQL: save pipeline
Project Service -> AI Service: create initial suggestions
AI Service -> PostgreSQL: save suggestions
Project Service -> Frontend: project summary
```

# Sequence: generate files

```text
Frontend -> API Gateway: POST /api/projects/{id}/generate
API Gateway -> Project Service: generate assets
Project Service -> TemplateCatalogService: resolve templates for saved tools
TemplateCatalogService: resolve BuildSphere placeholders and preserve Helm expressions
TemplateCatalogService: add disabled-by-default Terraform source for selected infrastructure
Project Service -> ArtifactStore: write generated archive
Project Service -> Pipeline Service: attach workflow metadata
Project Service -> Frontend: generated artifact summary
```

Helm is stored as the `packaging/helm` tool selection. Project Service rejects
that selection unless `deployment/kubernetes` is also present. The Deployment
Service validates rendered raw files under `kubernetes/`; Helm chart templates
under `helm/` remain source inputs for a later Helm render and are not parsed as
raw manifests.

Terraform AWS EKS is stored as the `infrastructure/terraform-aws-eks` tool
selection and requires `deployment/kubernetes`. Project Service generates
Terraform files under `terraform/` but does not invoke the Terraform CLI or AWS.
Generated CI is limited to `fmt`, `init -backend=false`, and `validate`.
