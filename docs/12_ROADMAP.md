# Document Information

| Field             | Value                    |
| ----------------- | ------------------------ |
| Document          | Roadmap                  |
| Version           | 0.1.0                    |
| Status            | Draft                    |
| Author            | BuildSphere Team         |
| Last Updated      | 2026-07-14               |
| Related Documents | 01_SRS.md, 13_BACKLOG.md |

---

# Purpose

This document defines the phased implementation roadmap for BuildSphere.

# Phase 0: Repository foundation

Status: Complete.

Goals:

- Create repository structure.
- Add documentation.
- Add Codex instructions.
- Add service skeletons.
- Add frontend skeleton.
- Add templates and prompts.

Exit criteria:

- Repository can be opened by Codex.
- Documentation explains what to build.
- Service folders exist.

# Phase 1: Core platform MVP

Status: Complete.

Goal: Build the minimum usable product.

Features:

1. Auth Service basic register/login.
2. API Gateway route forwarding.
3. Project Service create/list/view project.
4. Frontend auth pages and dashboard.
5. Create project wizard.
6. Tool selection model.
7. Template catalog model.

Exit criteria:

- User can sign up, log in, and create a project.
- Project data persists in PostgreSQL.
- Frontend displays created projects.

# Phase 2: Generation engine

Status: Complete.

Goal: Generate useful project and DevOps files.

Features:

1. Template resolver.
2. Node.js backend template.
3. React frontend template.
4. Dockerfile generation.
5. GitHub Actions workflow generation.
6. Kubernetes manifest generation.
7. Generated artifact archive.

Exit criteria:

- User can generate and download or inspect files for a selected stack.

# Phase 3: Pipeline model and logs

Status: Complete.

Goal: Show pipeline lifecycle.

Features:

1. Pipeline definition creation.
2. Pipeline stages.
3. Pipeline execution records.
4. Simulated execution runner.
5. Log storage.
6. Log viewer UI.
7. Stage explanations.

Exit criteria:

- User can trigger a simulated pipeline and view stage-by-stage logs.

# Phase 4: AI and recommendation engine

Status: Complete for local `rules` and `mock` modes. External provider calls remain future work.

Goal: Give meaningful suggestions.

Features:

1. Rule-based suggestion engine.
2. Prompt loading from `prompts/`.
3. Mock AI provider.
4. Optional external AI provider interface.
5. Suggestions UI.

Exit criteria:

- User receives actionable recommendations for generated assets.

# Phase 5: Deployment and observability foundations

Status: Complete.

Goal: Move toward real DevOps operations.

Features:

1. Kubernetes manifest validation.
2. Deployment target model.
3. Monitoring service health aggregation.
4. Prometheus metrics placeholder.
5. Notification service.

Exit criteria:

- User can define a deployment target and inspect deployment-ready assets.

# Phase 6: Advanced integrations

Status: Complete for the tracked GitHub integration milestone.

Phase 6 scope:

- GitHub OAuth. Complete.
- GitHub repository creation. Complete.
- GitHub Actions run integration. Complete.

Exit criteria:

- A connected user can publish generated files to a durable project repository link.
- BuildSphere can synchronize and display GitHub Actions workflow runs.
- Provider secrets remain server-side, expired user tokens rotate safely, and retry behavior is deterministic.

# Phase 7: Helm chart generation

Status: Complete.

Goal: Package generated Kubernetes workloads as a configurable, reusable Helm
chart without performing a real cluster deployment.

Features:

1. Optional Helm tool selection with a Kubernetes dependency.
2. Selection-aware template catalog resolution.
3. Helm chart metadata, values, helpers, workload, service, ingress, and notes.
4. Preserved Helm Go-template expressions in generated artifacts.
5. Raw Kubernetes validation isolated from Helm source templates.
6. Chart-aware generated CI checks and regression coverage.

Exit criteria:

- A Kubernetes project can opt into Helm and inspect, download, or publish a
  complete chart through existing artifact workflows.
- A project without Helm does not receive Helm files.
- Invalid Helm-without-Kubernetes selections fail with a structured error.
- Existing Phase 0-6 verification remains green.

# Phase 8: Terraform AWS EKS generation

Status: Complete as of 2026-07-10.

Goal: Generate safe, reviewable infrastructure-as-code for an AWS EKS target
without provisioning cloud resources.

Features:

1. Optional Terraform AWS EKS tool selection with a Kubernetes dependency.
2. Versioned Terraform, AWS provider, VPC module, and EKS module requirements.
3. Disabled-by-default VPC, EKS, managed-node, access, and output definitions.
4. Example local values, remote-backend guidance, state ignore rules, and
   operator documentation.
5. Generated CI format/init/validate checks without plan or apply.
6. Terraform CLI format and static validation plus cross-phase regression
   coverage.

Exit criteria:

- A Kubernetes project can opt into Terraform and inspect, download, or
  publish a complete AWS EKS root module.
- Unselected projects receive no `terraform/` files.
- Terraform without Kubernetes fails with a structured dependency error.
- Generated defaults create no cloud resources and contain no credentials.
- Generated Terraform passes format and static validation.
- Existing Phase 0-7 verification remains green.

Verification outcome:

- The default wizard bundle now contains 26 files, including all nine
  Terraform files, while projects without the selection receive no
  `terraform/` paths.
- A checksum-verified Terraform v1.15.8 binary passed format,
  backend-disabled initialization, exact module resolution, and static
  validation without credentials.
- Frozen install, lint, all builds, all 41 automated tests, the PostgreSQL
  gateway smoke, and the Phase 6 provider verifier pass.
- The 26-file Phase 8 artifact remained in PostgreSQL across application
  service restarts.
- No AWS or Kubernetes resource was created.

# Phase 9: Kubernetes deployment execution

Status: Complete as of 2026-07-11.

Goal: Add a controlled, observable deployment workflow while keeping cluster
mutation authority behind explicit credential, approval, ownership, and
rollback boundaries.

Planned slices:

1. BS-801 (complete 2026-07-11): ephemeral kubeconfig inspection, redacted
   target summaries, and non-executing deployment plans.
2. BS-802 (complete 2026-07-11): approved credential retention and idempotent
   apply execution against an explicitly configured test cluster.
3. BS-803 (complete 2026-07-11): durable deployment status observation and
   bounded rollback.

BS-802 exit criteria:

- Execution is opt-in and fails closed without encryption, host, and
  environment policy.
- Selected kubeconfig credentials are minimized, target-bound, encrypted, and
  revocable without entering public target JSON.
- An owned immutable artifact, exact digest, expiring single-use approval, and
  idempotency key are required for every apply.
- Namespace, resource-kind, ownership-label, concurrency, timeout, retry, and
  server-side apply controls are enforced and audited.

BS-803 exit criteria:

- Owned operations expose durable, read-only rollout summaries.
- A rollback requires a second approval and an immediately prior successful
  snapshot.
- Rollback reapplies the prior snapshot and can prune only namespaced resources
  whose BuildSphere ownership labels match.
- Namespace and cluster-scoped deletion are impossible through the rollback
  path.
- Apply, status, rollback, notifications, PostgreSQL durability, and the
  frontend workflow pass disposable-cluster and cross-phase verification.

BS-801 exit criteria:

- Kubeconfig is parsed with the official Kubernetes Node client.
- No credential-bearing kubeconfig field is persisted, logged, or returned.
- Connected and draft target states are explicit.
- Valid rendered manifests produce an ordered, explainable plan.
- Planning performs no Kubernetes API request and reports `executable: false`.
- Existing Phase 0-8 tests and smoke workflows remain green.

Phase 9 completion criteria:

- A user can explicitly approve deployment of a validated artifact to an owned
  Kubernetes target.
- BuildSphere tracks resource and rollout status and supports a bounded
  rollback path.
- Credentials, authorization, audit, timeout, retry, idempotency, and secret
  handling pass security review and live test-cluster verification.

BS-801 verification outcome:

- Frozen install, zero-warning lint, every production build, and all 46
  automated tests pass.
- Focused tests cover credential redaction, local-file reference rejection,
  unresolved contexts, draft-target blocking, owner scoping, resource ordering,
  and populated-Secret rejection.
- The PostgreSQL gateway smoke retains the 26-file, 7-stage, 14-log workflow and
  adds one redacted connection inspection plus a four-resource offline plan.
- The Phase 6 PostgreSQL verifier and checksum-verified Terraform v1.15.8
  format/init-without-backend/validate baseline remain green.
- Desktop and 390 px mobile browser workflows pass with no page overflow,
  secret disclosure, protected 401 response, console error, runtime exception,
  or Kubernetes API request.

Phase 9 completion verification outcome:

- Frozen installation, zero-warning lint, every production build, and all 59
  automated tests in 19 test files pass. Deployment Service contributes 20
  tests and API Gateway contributes three route-integration tests.
- Migrations 001-007 are idempotent. The Phase 9 PostgreSQL verifier confirms
  encrypted credential, three approval, and three operation records; exact
  and concurrent idempotency replay; prior-release resolution; rollback
  restoration; and full target cleanup. The Phase 6 provider verifier remains
  green.
- The complete gateway smoke retains 26 generated files, seven pipeline stages,
  14 logs, suggestions, four planned Kubernetes resources, eight monitored
  services, and durable notification read state.
- A checksum-matched kind v0.31.0 binary and pinned Kubernetes v1.34.3 node
  image completed two real releases, healthy rollout observation, a rollback,
  ownership verification, one-resource prune, and credential revocation. The
  disposable cluster was deleted and `kind get clusters` reports none.
- Terraform v1.15.8 format, backend-disabled initialization, exact module and
  provider resolution, and static validation remain green without AWS
  credentials.
- Desktop 1440x1000 and mobile 390x844 browser checks render the inspected
  target, four-resource plan, and operation empty state with no document
  overflow, console exception, or failed HTTP request.
- No production cluster, cloud account, Helm release, Terraform plan/apply, or
  remote state was touched.

# Phase 10: BuildSphere production deployment baseline

Status: Complete as of 2026-07-14.

Goal: Package BuildSphere itself as reproducible, non-root containers and a
safe Helm release suitable for controlled staging verification.

Completed slices:

1. BS-1001 (complete 2026-07-14): monorepo-aware production backend images and
   a production frontend image.
2. BS-1002 (complete 2026-07-14): BuildSphere-owned Helm chart, external
   runtime secret contract, migration hook, services, probes, and optional TLS
   ingress.
3. BS-1003 (complete 2026-07-14): structured packaging verification, CI
   image-build gates, and full Phase 0-9 regression coverage.

Exit criteria:

- Every backend service and the frontend has a buildable production image.
- Images run as non-root users and contain no `.env`, source-control metadata,
  development dependency set, or embedded credentials.
- Helm strict lint and structured render verification pass.
- The chart renders all platform workloads with external secrets/database,
  migration, probes, resource bounds, and deployment execution disabled.
- No-push Docker builds and a disposable-cluster staging smoke pass when the
  required local tooling is available.
- Existing tests, PostgreSQL verifiers, Terraform validation, and gateway smoke
  remain green.
- No external cluster, registry, cloud account, or production secret is
  modified.

Verification outcome:

- All ten backend images and the frontend build and pass non-root,
  read-only-root local health smoke checks.
- Helm v4.2.3 strict lint and structural verification pass for 38 resources,
  including all 11 workloads, a migration hook, a Helm test, 13 token-disabled
  ServiceAccounts, and zero Secrets.
- A checksum-matched kind v0.31.0 cluster using the pinned Kubernetes v1.34.3
  node image passed install, all seven migrations, 11 ready Deployments,
  frontend/API/database tests, upgrade, repeated migrations, and a second test.
  The cluster and random test-only credentials were deleted.
- Frozen installation, zero-warning lint, all production builds, all 61 tests,
  the complete gateway smoke, Phase 6 and Phase 9 PostgreSQL verifiers,
  Terraform v1.15.8 static validation, and the Phase 9 disposable-cluster
  apply/status/rollback flow remain green.
- CI validates the chart and builds all 11 images without registry login or
  push. No external cluster, cloud account, production Secret, or production
  resource was contacted.

# Phase 11: Production observability and SLO baseline

Status: Complete as of 2026-07-14.

Goal: Give operators a measurable service contract before adding production
autoscaling, high availability, and release automation.

Planned slices:

1. BS-1101: shared Prometheus runtime, process, and bounded HTTP RED metrics.
2. BS-1102: optional Prometheus Operator discovery, recording rules, and
   alerts in the BuildSphere chart.
3. BS-1103: versioned Grafana dashboard, SLO definitions, runbooks, and
   complete cross-phase verification.

Exit criteria:

- All ten backend services expose valid Prometheus metrics without requiring
  authentication or leaking high-cardinality/user-controlled labels.
- Monitoring Service preserves aggregate health metrics on the unified
  endpoint.
- The default Phase 10 chart remains installable without monitoring CRDs.
- Opt-in `ServiceMonitor` and `PrometheusRule` resources pass structural and
  expression-contract verification.
- Availability, server-error, and latency signals have documented objectives,
  alert thresholds, dashboard panels, and response runbooks.
- Workspace, PostgreSQL, image, chart, and disposable-cluster regressions from
  Phases 0-10 remain green.
- No external monitoring stack or production environment is modified.

Later production-hardening phases remain responsible for centralized log
retention, distributed tracing, network policy, autoscaling, database
operations, supply-chain release security, and external release certification.

Verification outcome:

- All ten backends expose isolated runtime and bounded HTTP RED metric families;
  Service Core and API tests cover route normalization, identifier redaction,
  scrape exclusion, and Monitoring Service gauge composition.
- The default chart retains its 38-resource, zero-Secret, no-monitoring-CRD
  contract. Opt-in rendering produces one ServiceMonitor, one PrometheusRule,
  six recording rules, and three alerts linked to checked-in runbooks.
- Helm v4.2.3 strict lint, Prometheus v3.12.0 rule validation, eight-panel
  dashboard checks, all 63 automated tests, all 11 hardened image smokes, and
  the Phase 0-10 PostgreSQL, Terraform, and disposable-cluster regressions pass.
- The Phase 10 cluster gate scraped every backend before and after chart
  upgrade. The separate Phase 9 real-client apply/status/rollback regression
  also passed; both clusters were deleted and no external environment changed.

# Post-Phase 11 candidates

These items require separate specifications and backlog milestones:

- Jenkins integration.
- Cost estimation.
- Team collaboration.
- Production security, reliability, observability, and release certification.

# Recommended first implementation order for Codex

1. Confirm workspace builds.
2. Implement shared types package.
3. Implement Auth Service.
4. Implement Project Service.
5. Implement API Gateway routes.
6. Implement frontend auth and dashboard.
7. Implement project wizard.
8. Implement template catalog.
9. Implement generation engine.
