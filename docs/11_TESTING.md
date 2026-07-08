# Document Information

| Field             | Value                |
| ----------------- | -------------------- |
| Document          | Testing Strategy     |
| Version           | 0.1.0                |
| Status            | Draft                |
| Author            | BuildSphere Team     |
| Last Updated      | 2026-07-08           |
| Related Documents | 01_SRS.md, 03_LLD.md |

---

# Purpose

This document defines how BuildSphere should be tested.

# Testing levels

## Unit tests

Use for:

- Validation logic.
- Service methods.
- Template selection.
- Pipeline status transitions.
- AI rule checks.

## API tests

Use for:

- Auth endpoints.
- Project CRUD.
- Pipeline endpoints.
- Suggestion endpoints.

## Integration tests

Use for:

- Database-backed workflows.
- Redis-backed workflows.
- Template generation writing artifacts.

## End-to-end tests

The MVP release workflow covers:

- Create account.
- Create project.
- Select tools.
- Generate assets.
- View suggestions.

# Minimum MVP test coverage

Every implemented service should have at least:

- Health endpoint test.
- Main happy-path test.
- Validation failure test.

# Test data rules

- Use fake users.
- Do not use real API keys.
- Use local test database or mocks.

# CI expectations

GitHub Actions should run:

```bash
pnpm lint
pnpm -r build
pnpm -r test
```

Future additions:

- Coverage reports.
- Docker build checks.
- Security scan.

# MVP smoke test

With all services running, `npm run smoke` verifies registration, project creation, tool selection, asset generation, pipeline simulation, log retrieval, suggestions, deployment validation, health aggregation, and notifications through the API Gateway.

`STORAGE_DRIVER=memory` can be used for a non-durable local smoke run. Release verification must still run the same workflow with PostgreSQL after applying migrations.

# MVP release verification

Completed on 2026-07-08:

- Frozen dependency installation, lint, production builds, and all automated tests passed.
- The complete verification gate passed on the preferred Node `v22.23.1` toolchain and the supported Node `v24.18.0` toolchain.
- The migration applied to PostgreSQL and a second run confirmed idempotency.
- The full gateway smoke workflow passed in memory and PostgreSQL modes.
- PostgreSQL records remained available after a complete application restart.
- The browser workflow passed from signup through project creation, generation, pipeline execution, suggestions, deployment validation, and target creation.
- Desktop and mobile checks found no page-level horizontal overflow; project tabs remain intentionally scrollable on narrow screens.
