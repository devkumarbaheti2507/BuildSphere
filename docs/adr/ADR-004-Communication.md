# ADR-004-Communication: REST-First Communication

## Status

Accepted

## Context

REST is easy to document, test, debug, and implement before event-driven complexity is needed.

## Decision

Use HTTP/REST between frontend, gateway, and backend services for the MVP.

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
