# Document Information

| Field             | Value                |
| ----------------- | -------------------- |
| Document          | Testing Strategy     |
| Version           | 0.1.0                |
| Status            | Draft                |
| Author            | BuildSphere Team     |
| Last Updated      | 2026-07-10           |
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

Phase 6 verification completed on 2026-07-09:

- At Phase 6 completion, all 39 automated tests passed, including OAuth
  state/PKCE checks, provider-token encryption and refresh, repository
  retry/idempotency, workflow-last publication, and Actions-run upserts.
- The PostgreSQL provider verifier passes against migrations 002 and 003.
- Live GitHub OAuth, private repository creation, publication of 10 generated files, successful Actions synchronization, and a no-op repeat publish passed.

Phase 7 verification completed on 2026-07-10:

- All 41 automated tests pass, including Helm dependency validation,
  selection-aware generation, chart structure and delimiter preservation, and
  isolation between raw Kubernetes validation and Helm chart source.
- Frozen installation, zero-warning lint, and every production build pass.
- The memory-mode gateway smoke passes with the optional Helm selection, 17
  generated files, 7 pipeline stages, 14 logs, deployment validation,
  suggestions, 8 monitored services, and 4 notifications.
- A checksum-verified official Helm `v4.2.2` binary passed `helm lint --strict`
  with zero chart failures and successfully rendered the generated Deployment,
  Service, and Ingress.
- The same 17-file workflow passed against PostgreSQL after migrations 001-003
  were confirmed idempotent. Login, the Helm selection, artifact, and pipeline
  remained retrievable through the gateway after a full application restart.
- The Phase 6 PostgreSQL provider verifier also passed with repository-link,
  workflow-run, token-refresh, and publication records.
