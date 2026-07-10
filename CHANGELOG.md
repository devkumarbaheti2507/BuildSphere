# Changelog

All notable changes to BuildSphere will be documented in this file.

The project follows semantic versioning once the first implementation milestone is complete.

## [Unreleased]

### Added

- A safe-to-share project knowledge graph, structured JSON graph, and presentation/learning guide covering the complete implementation through Phase 7.
- Enforceable TypeScript linting as part of workspace verification.
- Regression coverage for idempotent service shutdown.
- GitHub App authentication with PKCE, signed expiring state, verified-email account linking, encrypted provider token storage, and frontend callback handling.
- Provider discovery endpoints and an additive GitHub connection database migration.
- GitHub integration requirements, API documentation, security controls, and ADR-007.
- Project-scoped GitHub repository publishing with serial file updates, safe retries, and encrypted user-token rotation.
- Durable GitHub repository links and normalized GitHub Actions workflow-run synchronization.
- A project GitHub workspace for publishing generated artifacts and inspecting workflow runs.
- ADR-008 and additive migration 003 for project repository and workflow-run records.
- Phase 7 optional Helm selection with Kubernetes dependency validation.
- A seven-file Helm chart containing API v2 metadata, configurable values,
  namespaced helpers, Deployment, Service, Ingress, and installation notes.
- Selection-aware artifact generation and chart-aware generated CI checks.

### Fixed

- Prevent duplicate PostgreSQL pool closure during coordinated service shutdown.
- Skip unchanged GitHub file writes and publish workflow definitions last to avoid duplicate commits and partial-artifact workflow runs.
- Allow long-running serial GitHub publication requests through the API Gateway and Project Service integration boundary.
- Make the generated GitHub Actions workflow validate template-only MVP artifacts while conditionally running Node and Docker build steps when their inputs exist.
- Keep Helm Go-template expressions intact during BuildSphere rendering and
  exclude Helm chart source from raw Kubernetes manifest validation.

### Verified

- Frozen dependency installation, PostgreSQL migrations, durable gateway workflows, restart persistence, and responsive browser workflows through Phase 5.
- Node 22 frozen installation, lint, production builds, and all 29 automated tests after the BS-501 implementation.
- The live memory-mode gateway workflow and disabled GitHub provider-discovery path after the Phase 6 authentication changes.
- The complete Node 22 gate with 37 automated tests and the live memory-mode gateway workflow after BS-502 and BS-503.
- Idempotent migrations 002/003, the complete PostgreSQL gateway workflow, persistence after service restart, and the Phase 6 PostgreSQL provider verifier.
- Live GitHub OAuth, private repository creation, publication of 10 generated files, successful Actions run synchronization, and an idempotent no-op republish.
- The complete Phase 7 gate with 41 automated tests and a memory-mode gateway
  smoke producing 17 files while retaining all earlier workflow checks.
- Strict lint and manifest rendering with the checksum-verified official Helm
  v4.2.2 binary, plus the 17-file PostgreSQL gateway smoke, restart persistence,
  and Phase 6 PostgreSQL provider verifier.

## [0.1.0] - 2026-06-28

### Added

- Initial repository scaffold.
- Product documentation.
- Architecture documentation.
- Codex guidance via `AGENTS.md`.
- Backend service skeletons.
- Frontend skeleton.
- Infrastructure and template folders.
