# Document Information

| Field | Value |
| --- | --- |
| Document | Low Level Design |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-07-09 |
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

MVP does not perform real cloud deployment by default.

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
Project Service -> TemplateCatalogService: resolve templates
Project Service -> ArtifactStore: write generated archive
Project Service -> Pipeline Service: attach workflow metadata
Project Service -> Frontend: generated artifact summary
```
