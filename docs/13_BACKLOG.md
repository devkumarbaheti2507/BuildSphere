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
Status: Todo

Description:
Ensure root workspace, frontend, backend services, and packages can install and build.

Acceptance criteria:

- `pnpm install` succeeds.
- `pnpm -r build` succeeds.
- CI workflow passes.

## BS-002: Implement shared types package

Priority: High
Milestone: Phase 1
Status: Todo

Description:
Define shared TypeScript types for users, projects, pipelines, logs, and suggestions.

Acceptance criteria:

- Types exported from `packages/shared-types`.
- Backend services can import shared types.

## BS-003: Implement Auth Service register and login

Priority: High
Milestone: Phase 1
Status: Todo

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
Status: Todo

Description:
Build create/list/view project APIs.

Acceptance criteria:

- Authenticated user can create a project.
- User can list owned projects.
- User cannot view another user's project.

## BS-005: Implement API Gateway routing

Priority: High
Milestone: Phase 1
Status: Todo

Description:
Forward frontend requests to Auth and Project services.

Acceptance criteria:

- `/api/auth/*` routes to Auth Service.
- `/api/projects/*` routes to Project Service.
- Errors are normalized.

## BS-006: Build frontend auth screens

Priority: High
Milestone: Phase 1
Status: Todo

Description:
Create login and signup pages.

Acceptance criteria:

- User can submit signup form.
- User can submit login form.
- Access token is stored safely for MVP.

## BS-007: Build project dashboard

Priority: High
Milestone: Phase 1
Status: Todo

Description:
Show created projects and a create-project action.

Acceptance criteria:

- Dashboard lists projects.
- Empty state is shown when no projects exist.

# Phase 2 tickets

## BS-101: Implement template catalog

Priority: High
Milestone: Phase 2
Status: Todo

## BS-102: Implement project generation endpoint

Priority: High
Milestone: Phase 2
Status: Todo

## BS-103: Generate Dockerfile from template

Priority: High
Milestone: Phase 2
Status: Todo

## BS-104: Generate GitHub Actions workflow

Priority: High
Milestone: Phase 2
Status: Todo

## BS-105: Generate Kubernetes manifests

Priority: Medium
Milestone: Phase 2
Status: Todo

# Phase 3 tickets

## BS-201: Implement pipeline definition model

Priority: High
Milestone: Phase 3
Status: Todo

## BS-202: Implement simulated pipeline execution

Priority: High
Milestone: Phase 3
Status: Todo

## BS-203: Implement log storage and retrieval

Priority: High
Milestone: Phase 3
Status: Todo

## BS-204: Build pipeline timeline UI

Priority: Medium
Milestone: Phase 3
Status: Todo

# Phase 4 tickets

## BS-301: Implement rule-based suggestion engine

Priority: High
Milestone: Phase 4
Status: Todo

## BS-302: Load prompts from prompts folder

Priority: Medium
Milestone: Phase 4
Status: Todo

## BS-303: Build suggestions UI

Priority: Medium
Milestone: Phase 4
Status: Todo
