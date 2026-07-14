# Changelog

All notable changes to BuildSphere will be documented in this file.

The project follows semantic versioning once the first implementation milestone is complete.

## [Unreleased]

### Added

- A safe-to-share project knowledge graph, structured JSON graph, and
  presentation/learning guide covering the complete implementation through
  Phase 9.
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
- Phase 9 BS-801 Kubernetes preflight using the official Node client for
  ephemeral kubeconfig inspection, redacted target summaries, explicit draft
  and inspected states, and ordered offline deployment plans.
- A responsive Deployment tab workflow for kubeconfig file inspection,
  connected target creation, and four-resource plan review without cluster
  mutation authority.
- Phase 9 BS-802 opt-in Kubernetes execution with minimized AES-256-GCM
  credentials, exact API-server and environment policy, immutable-artifact
  approvals, durable idempotency, ownership checks, and server-side apply.
- Phase 9 BS-803 operation history, read-only rollout refresh, separate rollback
  approval, prior-release restoration, and ownership-bounded pruning.
- ADR-011, migrations 004-007, PostgreSQL and disposable-kind verification
  scripts, deployment notifications, gateway routes, and a responsive
  approve/deploy/status/rollback frontend workflow.
- A BuildSphere favicon used by the browser shell.
- Phase 10 monorepo-aware production images for all ten backend services and a
  non-root Nginx frontend image with same-origin `/api` routing.
- A BuildSphere-owned Helm chart with 11 workloads, external runtime secrets
  and PostgreSQL, pre-install/pre-upgrade migrations, hardened pod security,
  probes, resources, optional TLS ingress, and an in-cluster smoke test.
- Structured chart verification, no-push CI image builds, hardened local image
  smoke, and a repeatable disposable kind install/test/upgrade/test verifier.
- ADR-012 and the production deployment packaging specification.
- Phase 11 shared Node.js/process and bounded HTTP RED metrics on all ten
  backend services, with route-template normalization and identifier-safe
  labels.
- Optional ServiceMonitor and PrometheusRule chart resources, six recording
  rules, three alert rules, explicit API SLOs, an eight-panel Grafana dashboard,
  and three checked-in response runbooks.
- ADR-013, the production observability specification, a structural Phase 11
  verifier, CI `promtool` validation, backend image metric smoke, and
  ten-service in-cluster metrics checks.

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
- Reject kubeconfig local-file references before official-client parsing,
  prohibit populated Secret payloads in plans, and contain plan-table scrolling
  without widening desktop or mobile pages.
- Bind approvals to the current credential fingerprint so credential rotation
  after approval fails closed.
- Cascade target cleanup through Phase 9 audit tables without leaving orphaned
  approvals or operations.
- Serialize simultaneous retries for the same deployment idempotency key and
  treat rollback delete 404 responses as an already achieved outcome.
- Resolve templates, prompts, and migrations from an explicit flattened image
  root while retaining the monorepo-relative local fallback.
- Correct the backend image root variable so migration hooks read packaged SQL
  files from `/app/infrastructure/database/migrations`.

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
- The BS-801 gate with 46 tests, the 26-file PostgreSQL workflow plus a
  four-resource offline plan, Phase 6 provider persistence, Terraform static
  validation, and clean desktop/mobile kubeconfig-to-plan browser execution.
- The complete Phase 9 gate with frozen install, zero-warning lint, every
  production build, all 59 automated tests, migrations 001-007, Phase 6 and
  Phase 9 PostgreSQL verifiers, the full gateway smoke, Terraform static
  validation, and clean desktop/mobile deployment-plan rendering.
- A real two-release apply, healthy rollout read, rollback, one-resource prune,
  ownership check, credential revocation, and cluster cleanup against a
  disposable kind v0.31.0 cluster using Kubernetes v1.34.3.
- The complete Phase 10 gate with frozen install, zero-warning lint, every
  production build, all 61 tests, all 11 hardened image health checks, Helm
  v4.2.3 strict/structural validation, and all cross-phase smoke and PostgreSQL
  regressions.
- A disposable kind v0.31.0 / Kubernetes v1.34.3 chart workflow with seven
  migrations, 11 ready Deployments, successful frontend/API/database Helm
  tests before and after upgrade, and complete cluster cleanup.
- The complete Phase 11 gate with all 63 tests, Helm v4.2.3 strict validation,
  Prometheus v3.12.0 rule checks, all 11 hardened image smokes, the eight-panel
  dashboard contract, and Phase 0-10 PostgreSQL, Terraform, image, and real
  Kubernetes regressions.
- Every backend `/metrics` endpoint in the disposable Phase 10 chart before and
  after upgrade, plus repeat Phase 9 apply/status/rollback verification and
  cleanup with no external monitoring or production resource contacted.

## [0.1.0] - 2026-06-28

### Added

- Initial repository scaffold.
- Product documentation.
- Architecture documentation.
- Codex guidance via `AGENTS.md`.
- Backend service skeletons.
- Frontend skeleton.
- Infrastructure and template folders.
