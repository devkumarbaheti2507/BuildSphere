# Document Information

| Field | Value |
| --- | --- |
| Document | Software Requirements Specification |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
| Related Documents | 00_PROJECT_VISION.md, 02_HLD.md, specs/* |

---

# Purpose

This document defines what BuildSphere must do.

# Scope

The SRS covers the MVP and planned future versions. Implementation priority is defined in `docs/12_ROADMAP.md`.

# Functional requirements

## FR-001 User authentication

BuildSphere shall allow users to register, log in, log out, and manage authenticated sessions.

Acceptance criteria:

- User can register with name, email, and password.
- User can log in with email and password.
- Successful login returns an access token.
- Protected APIs reject unauthenticated requests.

## FR-002 Project management

BuildSphere shall allow authenticated users to create and manage projects.

Acceptance criteria:

- User can create a project with name, description, visibility, and architecture type.
- User can list owned projects.
- User can view project details.
- User can archive a project.

## FR-003 Stack and tool selection

BuildSphere shall allow users to select technology choices for a project.

Supported MVP choices:

- Frontend: React.
- Backend: Node.js.
- Database: PostgreSQL.
- Cache: Redis.
- CI/CD: GitHub Actions.
- Container: Docker.
- Deployment: Kubernetes manifests.

## FR-004 Template generation

BuildSphere shall generate project files based on selected tools.

Generated MVP assets:

- README.
- Dockerfile.
- docker-compose file.
- GitHub Actions workflow.
- Kubernetes deployment and service YAML.
- Environment variable example.

## FR-005 Pipeline management

BuildSphere shall store pipeline definitions and executions.

Acceptance criteria:

- User can create a pipeline from selected tools.
- User can view pipeline stages.
- User can view pipeline execution status.
- User can view logs for an execution.

## FR-006 Log visualization

BuildSphere shall provide a live-log style interface.

MVP can use simulated logs. Future versions can connect to GitHub Actions, Jenkins, Kubernetes, or custom runners.

## FR-007 Learning mode

BuildSphere shall explain pipeline stages in plain language.

Each stage explanation must include:

- What the step does.
- Why the step matters.
- Common failure reasons.
- How to fix common failures.

## FR-008 AI suggestions

BuildSphere shall provide suggestions based on project configuration and generated files.

MVP suggestions can be rule-based and optionally LLM-powered.

Suggestion categories:

- Docker optimization.
- Kubernetes readiness.
- Testing gaps.
- Security warnings.
- Architecture recommendations.

## FR-009 Template library

BuildSphere shall store reusable templates under `templates/` and expose them through the platform.

## FR-010 Notifications

BuildSphere shall support notification records for important events.

MVP notification types:

- Project created.
- Pipeline generated.
- Pipeline execution failed.
- Suggestion created.

# Non-functional requirements

## NFR-001 Usability

The platform should be understandable to a learner who knows basic Git, Docker, and CI/CD concepts.

## NFR-002 Reliability

Services should fail clearly and return structured errors.

## NFR-003 Security

No secrets may be stored in plaintext in source code. Authentication is required for user-owned resources.

## NFR-004 Maintainability

Each service must have a clear responsibility and matching spec file.

## NFR-005 Observability

Every backend service must expose a health endpoint and structured logs.

## NFR-006 Extensibility

Adding a new tool provider should not require rewriting the project wizard.

# Constraints

- MVP is local-first.
- MVP supports GitHub Actions before other CI/CD providers.
- MVP generates files before executing real deployments.
- TypeScript is the default implementation language.

# Assumptions

- Users already have basic programming knowledge.
- Users may inspect generated files manually.
- Real cloud deployment is not required in the first milestone.

# Out of scope for MVP

- Multi-tenant enterprise organization model.
- Real billing.
- Production-grade secret management.
- Full Kubernetes cluster administration.
- Custom distributed build runner.
