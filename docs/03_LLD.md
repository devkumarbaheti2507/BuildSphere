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
- Expose metrics endpoint in future.
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
