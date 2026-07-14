# Document Information

| Field             | Value                               |
| ----------------- | ----------------------------------- |
| Document          | Architecture Decision Records Index |
| Version           | 0.1.0                               |
| Status            | Draft                               |
| Author            | BuildSphere Team                    |
| Last Updated      | 2026-07-14                          |
| Related Documents | docs/adr/*                          |

---

# Purpose

This document indexes BuildSphere architecture decisions.

# ADR process

Create an ADR when a decision affects:

- Technology stack.
- Architecture style.
- Database choice.
- Communication model.
- AI provider strategy.
- Security model.
- Deployment model.

# Current ADRs

| ADR     | Decision                                                                | Status   |
| ------- | ----------------------------------------------------------------------- | -------- |
| ADR-001 | Repository structure                                                    | Accepted |
| ADR-002 | Microservice-oriented architecture                                      | Accepted |
| ADR-003 | PostgreSQL as primary database                                          | Accepted |
| ADR-004 | REST-first communication                                                | Accepted |
| ADR-005 | AI service design                                                       | Accepted |
| ADR-006 | Shared Service Core and ordered SQL migrations                          | Accepted |
| ADR-007 | GitHub App OAuth with signed state, PKCE, and encrypted provider tokens | Accepted |
| ADR-008 | Project/Auth service boundary for GitHub operations                     | Accepted |
| ADR-009 | Generate-only AWS EKS Terraform boundary                                | Accepted |
| ADR-010 | Ephemeral kubeconfig inspection and offline deployment planning         | Accepted |
| ADR-011 | Controlled Kubernetes execution and bounded rollback                    | Accepted |
| ADR-012 | Shared production images and BuildSphere-owned Helm release             | Accepted |

# ADR template

```markdown
# ADR-XXX: Title

## Status

Proposed | Accepted | Superseded

## Context

## Decision

## Alternatives considered

## Consequences
```
