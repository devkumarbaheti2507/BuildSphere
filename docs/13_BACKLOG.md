# Document Information

| Field             | Value                  |
| ----------------- | ---------------------- |
| Document          | Backlog                |
| Version           | 0.1.0                  |
| Status            | Draft                  |
| Author            | BuildSphere Team       |
| Last Updated      | 2026-07-10             |
| Related Documents | 12_ROADMAP.md, specs/* |

---

# Purpose

This file defines implementation tickets for BuildSphere.

# Ticket format

```text
ID:
Title:
Priority:
Milestone:
Owner:
Status:
Description:
Acceptance Criteria:
```

# Phase 1 tickets

## BS-001: Configure workspace build

Priority: High
Milestone: Phase 1
Status: Done

Description:
Ensure root workspace, frontend, backend services, and packages can install and build.

Acceptance criteria:

- `pnpm install` succeeds.
- `pnpm -r build` succeeds.
- CI workflow passes.

## BS-002: Implement shared types package

Priority: High
Milestone: Phase 1
Status: Done

Description:
Define shared TypeScript types for users, projects, pipelines, logs, and suggestions.

Acceptance criteria:

- Types exported from `packages/shared-types`.
- Backend services can import shared types.

## BS-003: Implement Auth Service register and login

Priority: High
Milestone: Phase 1
Status: Done

Description:
Build user registration and login endpoints.

Acceptance criteria:

- `POST /auth/register` works.
- `POST /auth/login` works.
- Passwords are hashed.
- JWTs are returned.

## BS-004: Implement Project Service project CRUD

Priority: High
Milestone: Phase 1
Status: Done

Description:
Build create/list/view project APIs.

Acceptance criteria:

- Authenticated user can create a project.
- User can list owned projects.
- User cannot view another user's project.

## BS-005: Implement API Gateway routing

Priority: High
Milestone: Phase 1
Status: Done

Description:
Forward frontend requests to Auth and Project services.

Acceptance criteria:

- `/api/auth/*` routes to Auth Service.
- `/api/projects/*` routes to Project Service.
- Errors are normalized.

## BS-006: Build frontend auth screens

Priority: High
Milestone: Phase 1
Status: Done

Description:
Create login and signup pages.

Acceptance criteria:

- User can submit signup form.
- User can submit login form.
- Access token is stored safely for MVP.

## BS-007: Build project dashboard

Priority: High
Milestone: Phase 1
Status: Done

Description:
Show created projects and a create-project action.

Acceptance criteria:

- Dashboard lists projects.
- Empty state is shown when no projects exist.

# Phase 2 tickets

## BS-101: Implement template catalog

Priority: High
Milestone: Phase 2
Status: Done

## BS-102: Implement project generation endpoint

Priority: High
Milestone: Phase 2
Status: Done

## BS-103: Generate Dockerfile from template

Priority: High
Milestone: Phase 2
Status: Done

## BS-104: Generate GitHub Actions workflow

Priority: High
Milestone: Phase 2
Status: Done

## BS-105: Generate Kubernetes manifests

Priority: Medium
Milestone: Phase 2
Status: Done

# Phase 3 tickets

## BS-201: Implement pipeline definition model

Priority: High
Milestone: Phase 3
Status: Done

## BS-202: Implement simulated pipeline execution

Priority: High
Milestone: Phase 3
Status: Done

## BS-203: Implement log storage and retrieval

Priority: High
Milestone: Phase 3
Status: Done

## BS-204: Build pipeline timeline UI

Priority: Medium
Milestone: Phase 3
Status: Done

# Phase 4 tickets

## BS-301: Implement rule-based suggestion engine

Priority: High
Milestone: Phase 4
Status: Done

## BS-302: Load prompts from prompts folder

Priority: Medium
Milestone: Phase 4
Status: Done

## BS-303: Build suggestions UI

Priority: Medium
Milestone: Phase 4
Status: Done

# Phase 5 tickets

## BS-401: Implement deployment targets and manifest validation

Priority: High
Milestone: Phase 5
Status: Done

## BS-402: Implement service health aggregation and metrics

Priority: Medium
Milestone: Phase 5
Status: Done

## BS-403: Implement user notifications

Priority: Medium
Milestone: Phase 5
Status: Done

# Release verification

## BS-901: Refresh dependency lockfile and run PostgreSQL integration verification

Priority: High
Milestone: MVP verification
Status: Done

Description:
Install the new `pg` dependency, regenerate `pnpm-lock.yaml`, run the SQL migration against PostgreSQL, and exercise the complete browser workflow.

Verification outcome:
The dependency lockfile was refreshed, frozen installation passed, the SQL migration applied idempotently to PostgreSQL, and the complete gateway workflow passed against durable storage on 2026-07-08. Persisted data was retrieved after an application restart.

## BS-902: Complete screenshot-based responsive UI verification

Priority: Medium
Milestone: MVP verification
Status: Done

Verification outcome:
The complete browser workflow passed from signup through deployment target creation. Desktop and mobile screenshots covered authentication, dashboard, and project views, and automated viewport checks found no page-level horizontal overflow.

# Phase 6 tickets

## BS-501: Add GitHub App OAuth login

Priority: High
Milestone: Phase 6
Status: Done

Description:
Allow a user to authenticate through a GitHub App and receive a normal BuildSphere session.

Acceptance criteria:

- Provider availability is discoverable without exposing secrets.
- Authorization uses signed state and PKCE.
- Callback processing requires a verified GitHub email.
- Existing users are linked by verified email and new users can be created without a local password.
- GitHub provider tokens are encrypted before PostgreSQL storage.
- Frontend login and callback states are complete and tested.

Verification outcome:
The complete Node 22 workspace gate passes for provider discovery, PKCE and signed-state validation, verified-email account creation and linking, encrypted token storage, and disabled-provider behavior. A live GitHub callback completed successfully against the configured local GitHub App on 2026-07-09.

## BS-502: Create GitHub repositories from generated artifacts

Priority: High
Milestone: Phase 6
Status: Done

Acceptance criteria:

- Project ownership and generated artifact selection are enforced by Project Service.
- The connected GitHub user token is refreshed before expiry when possible.
- Repository links are durable and one-to-one with BuildSphere projects.
- Generated files are validated and created or updated serially.
- Publishing can safely retry after partial provider failures.
- Repository creation and file publishing are covered by provider-double API tests.

Verification outcome:
Project ownership, artifact selection, token rotation, serial publishing, partial-failure retry, internal service authentication, unsafe-path rejection, unchanged-file skipping, and workflow-last ordering pass in automated tests. Migration 003 and the PostgreSQL provider verifier pass. A private live repository was created with 10 generated files, corrected through the same durable project link, and republished idempotently without creating another commit or repository.

## BS-503: Track GitHub Actions workflow runs

Priority: High
Milestone: Phase 6
Status: Done

Acceptance criteria:

- Synchronization is restricted to the project owner and linked repository.
- GitHub workflow runs are normalized and durably upserted by GitHub run ID.
- Repeated synchronization updates records without duplication.
- The frontend displays status, branch, run number, trigger, and GitHub URL.
- Provider failures and disconnected projects return structured errors.

Verification outcome:
Workflow-run status normalization, durable PostgreSQL upsert behavior, repeated synchronization without duplicates, project-owner enforcement, internal API behavior, and frontend compilation pass. Live synchronization persisted the repository's push runs, and corrected run 10 completed with a `success` conclusion.

# Phase 7 tickets

## BS-601: Generate configurable Helm charts

Priority: High
Milestone: Phase 7
Status: Done

Description:
Allow Kubernetes projects to optionally generate a standard Helm chart through
the existing project artifact workflow.

Acceptance criteria:

- Helm is a supported packaging selection that requires Kubernetes.
- Template resolution follows saved tool selections.
- Generated chart files include Chart metadata, values, helpers, Deployment,
  Service, Ingress, and installation notes.
- BuildSphere placeholders resolve without consuming Helm expressions.
- Raw Kubernetes validation excludes Helm source templates.
- Generated CI checks the optional chart structure.
- Project Service, Deployment Service, frontend, and full workspace regression
  tests pass.

Verification outcome:
The generated catalog follows saved selections, Helm requires Kubernetes, and
Helm-enabled projects produce a complete seven-file chart in a 17-file default
bundle. Frozen installation, lint, every production build, all 41 automated
tests, and the complete memory-mode gateway smoke passed on 2026-07-10. The
smoke retained the existing seven pipeline stages, 14 logs, deployment
validation, suggestions, eight health checks, and four notifications. A
checksum-verified Helm v4.2.2 binary then passed strict lint and template
rendering. The same 17-file workflow passed against PostgreSQL, persisted
through an application restart, and remained compatible with the Phase 6
PostgreSQL provider verifier.

# Phase 8 tickets

## BS-701: Generate safe AWS EKS Terraform configuration

Priority: High
Milestone: Phase 8
Status: Done

Description:
Allow Kubernetes projects to optionally generate a disabled-by-default AWS EKS
Terraform root module through the existing artifact workflow.

Acceptance criteria:

- `infrastructure/terraform-aws-eks` is supported and requires Kubernetes.
- The generated root module includes versions, provider configuration,
  variables, VPC/EKS modules, outputs, example values, backend guidance, ignore
  rules, and a README.
- Provider and registry module dependencies are explicitly versioned.
- Cluster creation defaults to disabled and access inputs are explicit.
- No generated file contains AWS credentials or an active remote-state backend.
- Generated CI runs only safe Terraform format/init/validate checks.
- Official Terraform CLI formatting and static validation pass.
- Phase 0-7 tests and smoke workflows remain green.

Verification outcome:
The wizard, shared contracts, API schema, dependency checks, generator, and
generated workflow support `infrastructure/terraform-aws-eks`. A selected
project emits the specified nine-file module and a project without the tool
emits no Terraform path. On 2026-07-10, frozen installation, zero-warning lint,
all builds, and all 41 tests passed. A checksum-verified Terraform v1.15.8
binary passed formatting, backend-disabled initialization of VPC `6.6.1`, EKS
`21.24.0`, and AWS provider `6.54.0`, plus static validation without AWS
credentials. The 26-file PostgreSQL gateway smoke and Phase 6 provider verifier
also passed; no plan, apply, destroy, AWS call, or cluster change was made.
