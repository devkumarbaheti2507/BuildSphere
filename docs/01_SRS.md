# Document Information

| Field             | Value                                    |
| ----------------- | ---------------------------------------- |
| Document          | Software Requirements Specification      |
| Version           | 0.1.0                                    |
| Status            | Draft                                    |
| Author            | BuildSphere Team                         |
| Last Updated      | 2026-07-10                               |
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

Acceptance criteria:

- The authenticated workspace displays an unread notification count.
- Users can open a notification center and read the complete title, message,
  event type, and timestamp for every notification.
- Users can mark one notification or all currently unread notifications as
  read, and all visible unread counts update immediately.
- Notification history and read actions remain scoped to the authenticated
  user.

## FR-011 GitHub identity integration

BuildSphere shall allow users to authenticate with a GitHub App before enabling repository and workflow integrations.

Acceptance criteria:

- The login screen only offers GitHub authentication when the provider is configured.
- The authorization request uses signed state and PKCE.
- The callback accepts only a valid, unexpired state bound to the PKCE verifier.
- BuildSphere requires a verified GitHub email address.
- A verified GitHub identity can create a new BuildSphere user or link to an existing user with the same verified email.
- GitHub provider tokens are encrypted before durable storage.
- Successful GitHub authentication returns the same BuildSphere access and refresh token session used by password login.

## FR-012 GitHub repository publishing

BuildSphere shall publish the latest generated artifact bundle to a repository
owned by the authenticated user's connected GitHub account.

Acceptance criteria:

- Only the project owner can start publishing.
- A project can be linked to one GitHub repository and retries reuse that repository.
- Repository visibility, name, description, default branch, and URL are stored.
- Generated file paths are validated and contents are written serially.
- Partial file-write failures preserve the repository link so publishing can be retried safely.
- Expired GitHub user tokens are refreshed and replacement tokens are encrypted before storage.

## FR-013 GitHub Actions synchronization

BuildSphere shall synchronize workflow runs from a linked GitHub repository.

Acceptance criteria:

- Only the project owner can synchronize or inspect workflow runs.
- GitHub run ID, workflow name, branch, commit, trigger, status, conclusion, timestamps, and URL are persisted.
- Repeated synchronization updates existing runs without creating duplicates.
- GitHub statuses and conclusions map to stable BuildSphere run states.
- The project interface links users to the source workflow run on GitHub.

## FR-014 Helm chart generation

BuildSphere shall optionally generate a Helm chart for projects that select
Kubernetes deployment.

Acceptance criteria:

- Helm is represented as an optional packaging tool and requires Kubernetes.
- Generated assets follow the project's saved tool selections.
- The chart uses Helm chart API version 2 and includes values, workload,
  service, ingress, reusable helpers, and installation notes.
- BuildSphere variables are resolved while Helm template expressions remain
  intact for later rendering by Helm.
- Raw Kubernetes manifest validation ignores Helm template source files.
- Generated Helm files are previewable, downloadable, and publishable through
  the existing artifact and GitHub workflows.
- BuildSphere does not install or upgrade the chart in a real cluster as part
  of this milestone.

## FR-015 Terraform AWS EKS generation

BuildSphere shall optionally generate a reviewable Terraform root module for
an AWS EKS deployment target.

Acceptance criteria:

- Terraform AWS EKS is represented as an infrastructure tool and requires the
  Kubernetes deployment selection.
- Generated configuration separates Terraform/provider requirements,
  variables, infrastructure, outputs, example values, backend guidance, ignore
  rules, and operator documentation.
- AWS, VPC, and EKS dependencies use explicit source addresses and version
  constraints.
- The generated default is inert and cannot create infrastructure until an
  operator explicitly enables cluster creation.
- Generated files contain no AWS credentials, active remote-state backend, or
  secret values.
- Generated CI may run format, initialization without a backend, and static
  validation, but must not run Terraform plan or apply.
- Terraform files use the existing artifact preview, download, and GitHub
  publishing workflows.
- BuildSphere does not call AWS or run Terraform plan/apply in this milestone.

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
