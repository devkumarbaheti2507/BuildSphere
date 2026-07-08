# Document Information

| Field | Value |
| --- | --- |
| Document | Backlog |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
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
Status: Blocked

Description:
Install the new `pg` dependency, regenerate `pnpm-lock.yaml`, run the SQL migration against PostgreSQL, and exercise the complete browser workflow.

Blocking condition:
The npm registry timed out repeatedly on 2026-07-07. Workspace builds, focused tests, and the full gateway-level smoke test pass in memory mode, but a fresh dependency install and live PostgreSQL verification still require registry connectivity.

## BS-902: Complete screenshot-based responsive UI verification

Priority: Medium
Milestone: MVP verification
Status: Blocked

Blocking condition:
The in-app browser was unavailable in the implementation session. TypeScript and the production Vite build pass, and the local frontend server starts successfully.
