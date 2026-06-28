# ADR-005-AI: AI Suggestion Engine

## Status

Accepted

## Context

The core product should work without a paid or external AI dependency.

## Decision

Use rule-based suggestions first, with optional LLM provider integration later.

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
