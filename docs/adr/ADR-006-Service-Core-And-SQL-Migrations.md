# ADR-006: Shared Service Core and SQL Migrations

## Status

Accepted.

## Context

Every BuildSphere service needs the same HTTP error shape, request correlation behavior, structured logging, JWT verification, internal notification client, and PostgreSQL connection rules. Reimplementing these mechanics in each service would create security and behavior drift. The MVP also needs an explicit, reviewable database migration strategy.

## Decision

Use `packages/service-core` for cross-cutting service mechanics only. Domain validation, repositories, and business workflows remain inside their owning backend services.

Use ordered SQL files under `infrastructure/database/migrations/` with a TypeScript migration runner. The runner records applied migrations and serializes execution with a PostgreSQL advisory lock.

## Consequences

- Services share consistent authentication, logging, errors, and correlation IDs.
- Domain ownership remains visible in service code.
- SQL schema changes are inspectable without an ORM abstraction.
- `pg` is the only new runtime database dependency.
- Future migration changes must be additive files rather than edits to an already-applied migration.
