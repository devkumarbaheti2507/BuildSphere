# Completed Features

## 2026-06-28

- Repository scaffold created.
- Documentation scaffold created.
- Service skeletons created.
- Frontend skeleton created.
- Templates and prompts created.
- PNPM workspace helper added for consistent local verification commands.
- BS-001 completed: `./scripts/verify-workspace.sh` installs dependencies, builds all workspace packages, and runs current test scripts.
- Project-level npm cache and toolchain warnings added to avoid broken global npm cache permissions and explain Node/PNPM setup differences.

## 2026-07-07

- BS-002 completed: shared MVP contracts now cover authentication, projects, tools, templates, artifacts, pipelines, logs, suggestions, deployment targets, notifications, and health.
- Added `packages/service-core` for consistent JWT authentication, scrypt password hashing, structured errors, correlation IDs, Pino request logs, PostgreSQL configuration, and internal notification publishing.
- BS-003 through BS-007 implemented: register/login/refresh/logout/profile APIs, project ownership and tool selection APIs, API Gateway routing, authentication UI, dashboard, and project wizard.
- Phase 2 implemented: template catalog, placeholder validation, generated React/Node/Docker/GitHub Actions/Kubernetes/environment files, checksums, previews, and TAR downloads.
- Phase 3 implemented: explainable pipeline definitions, valid execution transitions, simulated success/failure/cancellation, owner-scoped logs, timeline UI, and log viewer.
- Phase 4 implemented: thirteen deterministic recommendation rules, mock analyzer, external analyzer interface, prompt-file loading, persisted suggestion states, and suggestions UI.
- Phase 5 implemented: deployment target definitions, Kubernetes structural validation, service health aggregation, Prometheus-format gauges, user notifications, and notification event publishing.
- Added the initial PostgreSQL SQL migration and advisory-lock migration runner.
- Added a complete operational frontend and generated authentication visual asset at `frontend/public/assets/buildsphere-auth-workspace.png`.
- Monorepo recursive build passed for all workspace packages; all implemented backend API/unit tests passed.
- Added a non-durable memory storage mode and `npm run smoke`; the full gateway-level workflow passed with 10 generated files, 7 stages, 14 logs, suggestions, 8 health checks, and 4 notifications.
- Fresh lockfile generation and live PostgreSQL/browser verification remain blocked by npm registry timeouts and unavailable in-app browser access.

## 2026-07-08

- Refreshed `pnpm-lock.yaml` with `packages/service-core`, workspace links, and PostgreSQL dependencies; frozen installation now passes across all 14 workspace projects.
- Completed BS-901 with an idempotent PostgreSQL migration, full durable-storage smoke workflow, direct table verification, and persistence checks after application restart.
- Completed BS-902 with a full browser workflow plus desktop and mobile authentication, dashboard, and project verification.
- Added root ESLint configuration for all TypeScript and TSX sources and made lint part of `pnpm verify`.
- Added a shared idempotent graceful-shutdown helper and regression coverage, preventing duplicate PostgreSQL pool closure when multiple termination signals arrive.
- Installed Node `v22.23.1` through NVM and passed the complete verification gate on both Node 22 and Node 24.

## 2026-07-09

- Added a safe-to-share, ChatGPT-ready project knowledge graph with 77 validated nodes and 99 validated relationships, plus a presentation/demo guide and structured JSON companion.
- Reconciled stale Phase, ADR, database, UI, and testing documentation against the current Phase 6 implementation.

- Completed BS-501, the first Phase 6 slice: users can authenticate through a GitHub App and receive normal BuildSphere access and refresh tokens.
- Added signed expiring OAuth state, PKCE S256 binding, verified-email enforcement, stable GitHub identity lookup, and safe linking to existing users by verified email.
- Added AES-256-GCM provider token encryption and an additive `github_connections` migration; GitHub-only users can be stored without a local password.
- Added public provider discovery plus GitHub authorization and callback endpoints, frontend login/callback handling, shared contracts, configuration examples, and operational documentation.
- Added ADR-007 and the GitHub integration specification to establish GitHub Apps as the Phase 6 provider model.
- Passed the complete Node 22 verification gate: frozen installation, lint, all production builds, and 29 automated tests, including 10 Auth Service tests.
- Passed the live memory-mode gateway workflow after the OAuth changes with 10 generated files, 7 pipeline stages, 14 logs, suggestions, 8 health checks, and 4 notifications; disabled GitHub provider discovery also passed through the gateway.
- Live GitHub authorization completed successfully against the locally configured GitHub App.
- Completed BS-502: project owners can create or reuse a linked GitHub repository and serially publish a selected generated artifact with safe path, file-size, and retry handling.
- Added expiring GitHub user-token refresh with encrypted replacement-token persistence and explicit reauthorization failures.
- Completed BS-503: linked projects can synchronize, normalize, persist, and display GitHub Actions workflow runs without duplicate records.
- Added internal-token-protected Auth Service provider operations, Project Service ownership enforcement, frontend repository/Actions controls, ADR-008, and migration 003.
- Passed frozen installation, lint, every production build, all automated tests, and the complete live memory-mode gateway smoke after Phase 6 completion.
- Created a private live GitHub repository, published all 10 generated files, and synchronized the resulting workflow runs into PostgreSQL.
- Started Docker Desktop through its configured context, applied migrations 002 and 003, and confirmed a second migration run is idempotent.
- Verified the Phase 6 PostgreSQL schema, migration history, indexes, nullable provider password behavior, and encrypted-token columns directly.
- Passed the complete PostgreSQL-backed gateway workflow and confirmed its project and all eight tool selections remain available through the API after a full service restart.
- Added and passed `pnpm smoke:phase6:postgres`, which validates real PostgreSQL token rotation, repository-link persistence, workflow-run upserts, and cleanup with provider doubles.
- Corrected the live workflow to support template-only MVP artifacts; synchronized run 10 completed successfully.
- GitHub publication now skips unchanged blobs, writes workflow files last, and uses extended synchronous proxy timeouts. A repeated live publish created no extra commit or Actions run.
