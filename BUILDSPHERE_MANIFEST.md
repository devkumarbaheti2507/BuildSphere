# BuildSphere Manifest

This file defines the engineering constitution of BuildSphere. When there is uncertainty, follow this document first, then `AGENTS.md`, then the product and design documents.

## Product identity

BuildSphere is not a Jenkins clone, not a GitHub Actions clone, and not only a YAML generator.

BuildSphere is an AI-assisted Developer Experience Platform for creating, configuring, deploying, observing, and improving microservice applications.

## Core principles

### 1. Documentation-first development

Every feature starts with a requirement and design note before implementation.

Required order:

```text
SRS -> HLD/LLD -> Spec -> Code -> Test -> Docs update
```

### 2. Automation with explanation

BuildSphere must automate DevOps workflows while explaining what is happening and why it matters.

Every major workflow should support:

- Action performed.
- Tool used.
- Reason for the step.
- Possible failures.
- Suggested fixes.

### 3. Modular architecture

Services must be independently understandable and eventually independently deployable.

Each service owns:

- Its API.
- Its business logic.
- Its tests.
- Its documentation.
- Its data model or data ownership rules.

### 4. AI-assisted, not AI-dependent

AI suggestions are valuable but should not block the core product. The MVP must work without an external LLM by using rules and mock suggestions.

### 5. Safe defaults

Generated files must prefer secure and production-aware defaults:

- Non-root containers where possible.
- Health checks.
- Environment variable examples.
- No committed secrets.
- Clear deployment boundaries.

## Implementation conventions

### Language

Use TypeScript for the MVP unless a document explicitly states otherwise.

### API style

Use REST for MVP service APIs. Events can be added later.

### Data access

Use PostgreSQL for durable product data. Use Redis for cache, ephemeral sessions, job locks, and lightweight queues.

### Authentication

Use JWT access tokens and refresh tokens for MVP. OAuth with GitHub can be added after the username/password flow is stable.

### Logging

Every service must expose:

- `GET /health`
- Structured logs.
- Request correlation ID support.

### Testing

Minimum for each implemented feature:

- Unit tests for business logic.
- API tests for endpoints.
- Integration tests for database-backed workflows where practical.

## Definition of Done

A feature is done only when:

- Requirements are clear.
- API behavior is documented.
- Code is implemented.
- Tests pass.
- Errors are handled consistently.
- Related docs are updated.
- `memory/completed-features.md` is updated.
- `memory/next-session.md` is updated if work remains.

## Git conventions

Use conventional commits:

```text
feat: add project creation endpoint
fix: correct pipeline status transition
docs: update roadmap for MVP milestone
refactor: extract shared validation helpers
test: add auth service API tests
chore: update workspace config
```

## Branching model

Use simple feature branches:

```text
main
feature/auth-service
feature/project-wizard
feature/pipeline-generator
fix/log-stream-status
```

## Service naming

Use lowercase kebab-case folder names:

```text
auth-service
project-service
pipeline-service
```

Use PascalCase for TypeScript classes and types:

```text
ProjectService
PipelineExecution
ToolConfiguration
```

## Conflicts between docs and code

If code conflicts with documentation, do not silently choose one. Update the relevant document or add an ADR explaining why the implementation changed.
