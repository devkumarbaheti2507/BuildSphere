# ADR-003-Database: PostgreSQL Primary Database

## Status

Accepted

## Context

BuildSphere requires relational ownership, auditability, transactions, and structured queries.

## Decision

Use PostgreSQL as the primary durable database for MVP.

## Alternatives considered

- Build everything in one app.
- Use external managed services from day one.
- Delay documentation until after implementation.

## Consequences

Positive:

- Clear source of truth.
- Easier onboarding.
- Strong portfolio value.
- Easier AI-assisted development.

Tradeoffs:

- More initial structure.
- Requires discipline to keep docs updated.
