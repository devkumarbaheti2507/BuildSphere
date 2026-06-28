# Document Information

| Field | Value |
| --- | --- |
| Document | Low Level Design |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
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

Core modules:

- `AuthController`
- `AuthService`
- `UserRepository`
- `TokenService`
- `PasswordService`

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
