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
