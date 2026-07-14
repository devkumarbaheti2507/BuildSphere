# Document Information

| Field             | Value                |
| ----------------- | -------------------- |
| Document          | Testing Strategy     |
| Version           | 0.1.0                |
| Status            | Draft                |
| Author            | BuildSphere Team     |
| Last Updated      | 2026-07-14           |
| Related Documents | 01_SRS.md, 03_LLD.md |

---

# Purpose

This document defines how BuildSphere should be tested.

# Testing levels

## Unit tests

Use for:

- Validation logic.
- Service methods.
- Template selection.
- Pipeline status transitions.
- AI rule checks.

## API tests

Use for:

- Auth endpoints.
- Project CRUD.
- Pipeline endpoints.
- Suggestion endpoints.

## Integration tests

Use for:

- Database-backed workflows.
- Redis-backed workflows.
- Template generation writing artifacts.

## End-to-end tests

The MVP release workflow covers:

- Create account.
- Create project.
- Select tools.
- Generate assets.
- View suggestions.

# Minimum MVP test coverage

Every implemented service should have at least:

- Health endpoint test.
- Main happy-path test.
- Validation failure test.

# Test data rules

- Use fake users.
- Do not use real API keys.
- Use local test database or mocks.

# CI expectations

GitHub Actions should run:

```bash
pnpm lint
pnpm -r build
pnpm -r test
```

Future additions:

- Coverage reports.
- Security scan.
- Signed image publication.
- Approved staging deployment.

# MVP smoke test

With all services running, `npm run smoke` verifies registration, project creation, tool selection, asset generation, pipeline simulation, log retrieval, suggestions, deployment validation, health aggregation, and notifications through the API Gateway.

`STORAGE_DRIVER=memory` can be used for a non-durable local smoke run. Release verification must still run the same workflow with PostgreSQL after applying migrations.

# MVP release verification

Completed on 2026-07-08:

- Frozen dependency installation, lint, production builds, and all automated tests passed.
- The complete verification gate passed on the preferred Node `v22.23.1` toolchain and the supported Node `v24.18.0` toolchain.
- The migration applied to PostgreSQL and a second run confirmed idempotency.
- The full gateway smoke workflow passed in memory and PostgreSQL modes.
- PostgreSQL records remained available after a complete application restart.
- The browser workflow passed from signup through project creation, generation, pipeline execution, suggestions, deployment validation, and target creation.
- Desktop and mobile checks found no page-level horizontal overflow; project tabs remain intentionally scrollable on narrow screens.

Phase 6 verification completed on 2026-07-09:

- At Phase 6 completion, all 39 automated tests passed, including OAuth
  state/PKCE checks, provider-token encryption and refresh, repository
  retry/idempotency, workflow-last publication, and Actions-run upserts.
- The PostgreSQL provider verifier passes against migrations 002 and 003.
- Live GitHub OAuth, private repository creation, publication of 10 generated files, successful Actions synchronization, and a no-op repeat publish passed.

Phase 7 verification completed on 2026-07-10:

- All 41 automated tests pass, including Helm dependency validation,
  selection-aware generation, chart structure and delimiter preservation, and
  isolation between raw Kubernetes validation and Helm chart source.
- Frozen installation, zero-warning lint, and every production build pass.
- The memory-mode gateway smoke passes with the optional Helm selection, 17
  generated files, 7 pipeline stages, 14 logs, deployment validation,
  suggestions, 8 monitored services, and 4 notifications.
- A checksum-verified official Helm `v4.2.2` binary passed `helm lint --strict`
  with zero chart failures and successfully rendered the generated Deployment,
  Service, and Ingress.
- The same 17-file workflow passed against PostgreSQL after migrations 001-003
  were confirmed idempotent. Login, the Helm selection, artifact, and pipeline
  remained retrievable through the gateway after a full application restart.
- The Phase 6 PostgreSQL provider verifier also passed with repository-link,
  workflow-run, token-refresh, and publication records.

Phase 8 verification completed on 2026-07-10:

- Frozen installation, zero-warning lint, all production builds, and all 41
  automated tests pass, including Terraform selection, dependency, exact file,
  safe-default, module-pin, generated-CI, and unselected-project assertions.
- A checksum-verified official Terraform `v1.15.8` binary passed
  `terraform fmt -check -recursive`, downloaded and initialized the exact VPC
  `6.6.1` and EKS `21.24.0` modules with `-backend=false`, selected AWS provider
  `6.54.0`, and reported a valid configuration without AWS credentials.
- The PostgreSQL-backed gateway smoke passes with 26 generated files, 7
  pipeline stages, 14 logs, deployment validation, suggestions, 8 monitored
  services, and 4 notifications. The 26-file artifact remained in PostgreSQL
  after the final build restarted the application services.
- The Phase 6 PostgreSQL provider verifier remains green. No Terraform plan,
  apply, destroy, state mutation, AWS API call, or Kubernetes cluster operation
  was performed.

Notification experience completion verified on 2026-07-10:

- The PostgreSQL gateway smoke marks an unread notification through
  `PATCH /notifications/{notificationId}/read`, lists notifications again, and
  confirms that the persisted `readAt` value is returned.
- A live browser test opened the complete notification center with three unread
  events, verified full message visibility, marked one event read, and then
  marked the remaining events read in bulk.
- All three PATCH requests returned 200. The topbar badge, drawer summary, and
  dashboard unread count updated together from three to zero, with no protected
  401 responses or browser runtime exceptions.
- Desktop at 1440x1000 and mobile at 390x844 both kept the drawer, close control,
  and notification text inside the viewport with no horizontal overflow.

Phase 9 BS-801 verification completed on 2026-07-11:

- Frozen installation, zero-warning lint, every production build, and all 46
  automated tests pass. Deployment Service now contributes eight tests.
- Kubeconfig tests verify allowlisted summaries, credential redaction,
  local-file-reference rejection before client parsing, and unresolved-context
  errors.
- API/planner tests verify authenticated draft targets, inspected targets,
  owner scoping, non-executable plans, deterministic resource ordering, and
  populated Kubernetes Secret rejection.
- The PostgreSQL gateway smoke passed with 26 generated files, 7 pipeline
  stages, 14 logs, one suggestion, a four-resource offline deployment plan, 8
  monitored services, 4 notifications, and persisted notification read state.
- Migrations 001-003 remained idempotent, the Phase 6 PostgreSQL provider
  verifier passed, and checksum-verified Terraform v1.15.8 again passed format,
  backend-disabled initialization, exact module/provider resolution, and static
  validation.
- A live browser uploaded a synthetic kubeconfig, inspected it, created a
  redacted target, and rendered the plan at desktop and 390x844 mobile sizes.
  No page overflow, secret disclosure, protected 401, console error, runtime
  exception, or Kubernetes API request occurred.

Phase 9 BS-802/BS-803 completion verified on 2026-07-11:

- Frozen installation, zero-warning lint, every production build, and all 59
  automated tests in 19 test files pass on supported Node v24.18.0. Node 22
  remains the preferred toolchain.
- Deployment Service contributes 20 tests covering fail-closed capability
  configuration, authenticated target-bound encryption, selected-context
  minimization, dynamic credential and proxy rejection, exact server/TLS
  policy, namespace and Secret rejection, ownership prechecks, bounded retries,
  idempotency, approval expiry, credential rotation, target concurrency,
  operation status, active-release resolution, and rollback pruning.
- API Gateway tests confirm project-scoped operation routing, credential PUT
  forwarding, CORS, authentication, and timeout integration.
- Migrations 001-007 rerun idempotently. `npm run smoke:phase9:postgres`
  confirms one credential, three approvals, three operations, exact replay,
  serialized simultaneous same-key replay, prior-release resolution,
  active-release restoration, and cascade cleanup. `npm run
smoke:phase6:postgres` remains green.
- The full gateway smoke passes with 26 generated files, seven stages, 14 logs,
  one suggestion, a four-resource plan, zero operations while execution is
  disabled, eight monitored services, four notifications, and persisted read
  state.
- Official Terraform v1.15.8 again passes format, backend-disabled init with
  the exact VPC/EKS modules and AWS provider, and static validation without AWS
  credentials.
- A checksum-matched official kind v0.31.0 binary with the pinned Kubernetes
  v1.34.3 node image completed two approved releases through the real
  Deployment Service and official Kubernetes client. The verifier observed a
  healthy rollout, rolled back to release one, pruned only the release-two
  ConfigMap, confirmed ownership labels directly, revoked the credential, and
  deleted the cluster.
- A live Chrome check at 1440x1000 and 390x844 rendered an inspected target,
  built the four-resource plan through the UI, and showed durable-operation
  empty state without horizontal overflow, console errors, or failed HTTP
  requests.
- No production or cloud resource was contacted. No Helm command, Terraform
  plan/apply/destroy, AWS request, or remote-state operation occurred.

Phase 10 production packaging completed and verified on 2026-07-14:

- Frozen installation, zero-warning lint, every production build, and all 61
  automated tests pass. Service Core contributes two new runtime-root tests.
- Helm v4.2.3 strict lint and structural parsing pass for 38 rendered resources:
  11 Deployments, 11 Services, 13 ServiceAccounts, one migration Job, one test
  Pod, and zero Secrets. Invalid `latest` tags and incomplete execution policy
  fail rendering.
- All ten backend images and the frontend image build from the repository root.
  Each starts as a declared non-root user under read-only-root,
  dropped-capability, no-privilege-escalation smoke restrictions and reaches
  its health check.
- A checksum-matched kind v0.31.0 binary with the pinned Kubernetes v1.34.3
  node image installed the chart against an ephemeral PostgreSQL 16 fixture.
  All seven migrations applied and all 11 Deployments became ready.
- The Helm test passed from inside the namespace by checking frontend
  `/healthz`, API Gateway to Auth Service provider routing, and exactly seven
  `schema_migrations` records.
- A Helm upgrade reran the idempotent pre-upgrade migration hook, reached
  revision two, and passed the same test again. The cluster and random
  test-only credentials were deleted afterward.
- Cross-phase verification remained green: the 26-file gateway smoke, Phase 6
  and Phase 9 PostgreSQL verifiers, Terraform v1.15.8
  format/init-without-backend/validate, and the Phase 9 real Kubernetes
  apply/status/rollback/prune/revocation flow.
- CI now runs chart verification and no-push builds for all 11 images. No
  registry, external cluster, cloud account, production Secret, Terraform
  state, or production resource was modified.

Phase 11 production observability completed and verified on 2026-07-14:

- Frozen installation, zero-warning lint, every production build, and all 63
  automated tests pass. The two new Service Core tests verify Prometheus
  content type, metric families, matched-route labels, raw identifier and query
  redaction, scrape exclusion, and isolated registries.
- API Gateway and Monitoring Service API tests confirm safe proxy route labels
  and the unified shared plus aggregate-health metric response.
- Helm v4.2.3 strict lint and the Phase 11 structural verifier pass. The default
  chart still renders 38 resources with no monitoring CRDs or Secrets; opt-in
  rendering produces one ServiceMonitor, one PrometheusRule, six recording
  rules, and three runbook-linked alerts.
- Prometheus v3.12.0 `promtool check rules` passes for the rendered rule groups.
  Dashboard verification parses eight unique, non-overlapping panels and finds
  no fixed endpoint or credential.
- All 11 images rebuilt. Every backend image exposed its expected service label
  on `/metrics` while running non-root with a read-only root, dropped
  capabilities, and no privilege escalation.
- The full gateway smoke, migrations 001-007, Phase 6 and Phase 9 PostgreSQL
  verifiers, and Terraform v1.15.8 static validation remained green.
- The Phase 10 kind install/test/upgrade/test gate passed with all ten backend
  metrics scrapes before and after upgrade. The independent Phase 9 real-client
  apply/status/rollback/prune/revocation cluster regression also passed, and
  both disposable clusters were deleted.
- No external monitoring stack, cluster, registry, cloud account, production
  Secret, alert receiver, or production resource was contacted or modified.
