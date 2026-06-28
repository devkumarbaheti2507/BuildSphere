# ADR-001-Repository-Structure: Repository Structure

## Status

Accepted

## Context

Keeps all product knowledge and code in one repository, making it easier for Codex and human contributors to navigate.

## Decision

Use a monorepo with separate documentation, specs, frontend, backend services, packages, templates, and infrastructure folders.

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
