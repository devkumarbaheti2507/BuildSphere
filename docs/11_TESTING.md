# Document Information

| Field | Value |
| --- | --- |
| Document | Testing Strategy |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
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

Future:

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
pnpm -r build
pnpm -r test
```

Future additions:

- Lint.
- Coverage reports.
- Docker build checks.
- Security scan.
