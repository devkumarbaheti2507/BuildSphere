# Changelog

All notable changes to BuildSphere will be documented in this file.

The project follows semantic versioning once the first implementation milestone is complete.

## [Unreleased]

### Added

- A safe-to-share project knowledge graph, structured JSON graph, and
  presentation/learning guide covering the complete implementation through
  Phase 8.
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
- Phase 8 optional AWS EKS Terraform selection with Kubernetes dependency
  validation and a nine-file, disabled-by-default root module.
- Exact VPC `6.6.1` and EKS `21.24.0` module pins, bounded Terraform/AWS
  provider requirements, guarded access and endpoint inputs, backend guidance,
  state ignore rules, outputs, example values, and operator documentation.
- Generated Terraform CI checks and a repeatable real-catalog validator limited
  to format, backend-disabled initialization, and static validation.
- A full notification center with complete event history, unread count, readable
  message details, individual read actions, and a bulk mark-all-read action.

### Fixed

- Refresh stored browser sessions before protected requests and recover from
  later unauthorized responses without repeatedly polling APIs with an expired
  access token.
- Keep notification read state synchronized across the notification center,
  topbar badge, and dashboard instead of leaving every event visibly unread.
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
- The complete Phase 8 gate with frozen install, zero-warning lint, all builds,
  all 41 automated tests, and a PostgreSQL gateway smoke producing 26 files
  while retaining all earlier workflow checks.
- A SHA-256-verified official Terraform v1.15.8 binary passed formatting,
  backend-disabled initialization, provider/module resolution, and static
  validation without AWS credentials; the Phase 6 PostgreSQL verifier also
  remained green, and the 26-file artifact persisted across application service
  restarts.
- PostgreSQL notification read persistence plus live desktop/mobile notification
  interactions, including one-item and mark-all-read flows, synchronized counts,
  full message rendering, and clean authenticated API/browser execution.

## [0.1.0] - 2026-06-28

### Added

- Initial repository scaffold.
- Product documentation.
- Architecture documentation.
- Codex guidance via `AGENTS.md`.
- Backend service skeletons.
- Frontend skeleton.
- Infrastructure and template folders.
