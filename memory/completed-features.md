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

## 2026-07-10

- Completed BS-601 and roadmap Phase 7: Kubernetes projects can optionally
  select `packaging/helm` and generate a configurable Helm chart through the
  existing preview, TAR download, and GitHub publication workflows.
- Added selection-aware template resolution so artifacts contain only files
  implied by saved tools; existing projects without Helm receive no `helm/`
  paths.
- Added Helm API v2 chart metadata, values, namespaced helpers, Deployment,
  Service, Ingress, and installation notes with configurable replicas, image,
  ports, ingress, probes, and resources.
- Added structured Helm-to-Kubernetes dependency validation, preserved Helm
  Go-template expressions during BuildSphere rendering, and isolated Helm chart
  source from raw Kubernetes validation.
- Updated the project wizard and generated GitHub Actions checks for optional
  Helm packaging.
- Passed frozen installation, zero-warning lint, every production build, and
  all 41 automated tests on Node 24; Node 22 remains the preferred toolchain.
- Passed the complete memory-mode gateway smoke with 17 generated files, 7
  stages, 14 logs, suggestions, Kubernetes validation, 8 monitored services,
  and 4 notifications.
- Downloaded the official Helm v4.2.2 Linux binary to `/tmp`, verified its
  published SHA-256 checksum, passed `helm lint --strict` with zero failures,
  and rendered the chart's Deployment, Service, and Ingress successfully.
- Passed the same Helm-enabled 17-file gateway workflow against PostgreSQL,
  confirmed migrations 001-003 remained idempotent, and retrieved the project,
  Helm selection, artifact, and pipeline after a full application restart.
- Re-ran `pnpm smoke:phase6:postgres`; repository-link persistence,
  workflow-run upsert, token refresh, publication, and cleanup all passed.
- No chart was installed into a Kubernetes cluster.

- Completed BS-701 and roadmap Phase 8: Kubernetes projects can optionally
  select `infrastructure/terraform-aws-eks` and generate a nine-file AWS EKS
  Terraform root module through preview, TAR download, persistence, and GitHub
  publication workflows.
- Added the Terraform tool/category contracts, structured Kubernetes dependency
  error, wizard toggle, AWS region/environment defaults, and selection-aware
  catalog entries; projects without the selection receive no `terraform/`
  paths.
- Generated exact VPC `6.6.1` and EKS `21.24.0` module definitions with bounded
  Terraform/AWS provider requirements, managed nodes and add-ons, private API
  access, explicit administrator access, deletion protection, guarded scaling,
  non-secret example values, inactive backend guidance, outputs, ignore rules,
  and an operator README.
- Kept `enable_cluster` false by default and generated no credentials, active
  backend, state, plan, apply, destroy, or AWS operation.
- Added optional generated GitHub Actions checks using
  `hashicorp/setup-terraform@v4` and Terraform v1.15.8, limited to format,
  backend-disabled initialization, and static validation.
- Added `pnpm verify:terraform`, which renders through the real template catalog
  into a temporary directory, checks nine-file/no-secret invariants, and runs
  the same safe Terraform commands.
- Downloaded the official Terraform v1.15.8 Linux binary to `/tmp`, matched its
  published SHA-256 checksum, initialized VPC `6.6.1`, EKS `21.24.0`, and AWS
  provider `6.54.0`, and passed format and static validation without AWS
  credentials.
- Passed frozen installation, zero-warning lint, every production build, and
  all 41 automated tests on Node 24.
- Passed the PostgreSQL-backed gateway smoke with 26 generated files, 7 stages,
  14 logs, deployment validation, suggestions, 8 monitored services, and 4
  notifications; the exact 26-file artifact remained in PostgreSQL after
  application service restarts, and `pnpm smoke:phase6:postgres` also remained
  green.
- No Terraform plan/apply/destroy, AWS API call, remote-state change, Helm
  operation, or Kubernetes cluster operation was performed.
- Reconciled the learning/presentation pack through Phase 8 and validated its
  structured companion with 77 nodes, 125 relationships, and no dangling
  edges.
- Fixed stale browser-session recovery after backend restarts: the frontend now
  refreshes stored sessions before protected data loads, deduplicates concurrent
  refresh attempts, and returns to sign-in when refresh authorization fails.
- Completed the notification experience: the topbar opens a full-history drawer,
  recent dashboard events expose individual read actions, and users can mark one
  or all unread events read while every visible unread count stays synchronized.
- Extended the PostgreSQL gateway smoke to persist and relist notification
  `readAt` state. A live browser run verified three successful read updates,
  complete message rendering, zero final unread counts, no authenticated 401s or
  runtime exceptions, and contained desktop/mobile layouts.

## 2026-07-11

- Completed BS-801, the first Phase 9 slice: authenticated users can inspect a
  kubeconfig ephemerally, create draft or inspected Kubernetes targets, and
  build an ordered offline plan from rendered manifests.
- Added `@kubernetes/client-node` 1.4.0 for structured kubeconfig and Kubernetes
  YAML parsing. A structured guard rejects `token-file`, client certificate/key
  file paths, and certificate-authority file references before official-client
  parsing can read local files.
- Persisted target configuration is allowlisted to context, cluster, API server
  host, namespace, credential mechanism, TLS posture, and context count. Raw
  kubeconfig, tokens, passwords, certificates, keys, and exec arguments are not
  stored or returned.
- Added offline plan validation, resource identity and ordering, duplicate
  detection, owner scoping, default namespace resolution, and populated
  Kubernetes Secret rejection. Every plan reports `executable: false` and
  `clusterRequestMade: false`.
- Added a responsive Deployment tab flow for kubeconfig upload, inspection,
  inspected target creation, and a dense four-resource plan table with internal
  mobile scrolling.
- Passed frozen installation, zero-warning lint, every production build, and
  all 46 automated tests. Deployment Service contributes eight tests covering
  the new security and planning behavior.
- Passed idempotent migrations 001-003, the Phase 6 PostgreSQL provider
  verifier, checksum-verified Terraform v1.15.8 static validation, and the
  PostgreSQL gateway smoke with 26 files, 7 stages, 14 logs, one suggestion, a
  four-resource offline plan, 8 monitored services, and 4 notifications.
- Passed the complete desktop and 390 px mobile browser workflow with no secret
  disclosure, page overflow, protected 401 response, console error, runtime
  exception, or Kubernetes API request.
- At the BS-801 checkpoint, no Kubernetes credential was retained and no
  cluster resource was created, updated, or deleted; execution was deferred to
  BS-802.
- Completed BS-802 and BS-803, closing roadmap Phase 9 with opt-in approved
  Kubernetes apply, durable rollout status, and bounded rollback.
- Added fail-closed execution policy for a dedicated AES-256-GCM key, exact
  API-server `host:port` allowlist, and allowed environments. Selected
  kubeconfig credentials are minimized, reject dynamic/file/proxy/impersonation
  paths, are authenticated to owner and target, and remain separate from public
  target metadata.
- Added immutable Project Service artifact resolution, exact manifest digests,
  five-minute single-use approvals, credential-fingerprint binding, durable
  idempotency, one active operation per target, and safe notification events.
- Added constrained official-client server-side apply with `force=false`,
  namespace/kind/Secret restrictions, existing-resource ownership prechecks,
  BuildSphere labels, operation/request timeouts, and bounded transient retries.
- Added owner-scoped operation history, summarized read-only rollout refresh,
  separate rollback approval, prior-active-release resolution, prior-snapshot
  reapply, and deletion of only newly introduced namespaced ownership-matched
  resources. Namespace and cluster-scoped deletion are prohibited.
- Added migrations 004-007 for encrypted target credentials, approvals,
  operations, active-release restoration, safe cleanup, and credential-version
  binding. The Phase 9 PostgreSQL verifier passes exact replay, three-operation
  history, restored active release, and target cascade cleanup.
- Added the complete frontend credential/approval/deploy/status/rollback flow,
  gateway routes and timeouts, shared contracts, deployment notifications,
  ADR-011, operational docs, and repeatable PostgreSQL/kind verification scripts.
- Passed frozen installation, zero-warning lint, every production build, all 59
  automated tests in 19 files, the complete gateway smoke, Phase 6 and Phase 9
  PostgreSQL verifiers, and Terraform v1.15.8 static validation.
- Passed a real disposable kind v0.31.0 workflow using the pinned Kubernetes
  v1.34.3 node image: two releases applied, rollout healthy, rollback restored
  release one, one newer ConfigMap pruned, ownership verified directly,
  credential revoked, and cluster deleted.
- Passed desktop 1440x1000 and mobile 390x844 Chrome checks with the inspected
  target, four-resource plan, no horizontal overflow, and zero console or HTTP
  errors. Added the missing browser favicon discovered by this gate.
- Serialized simultaneous PostgreSQL claims for the same idempotency key,
  verified one operation plus one replay, and made already-missing rollback
  deletes idempotently successful.
- Reconciled the safe learning graph to 80 nodes and 130 relationships with no
  duplicate nodes or dangling edges.
- No production cluster or cloud account was touched. Real Helm operations,
  Terraform plan/apply/destroy, AWS credentials/state, and production deployment
  remain outside the completed scope.

## 2026-07-14

- Defined and completed Phase 10 through FR-019, the production deployment
  packaging specification, ADR-012, and tickets BS-1001 through BS-1003.
- Replaced ten isolated workspace-incompatible Docker stubs with one
  allowlisted monorepo-aware backend Dockerfile using frozen PNPM builds and
  production-only deploy trees.
- Added a separate multi-stage frontend image with same-origin `/api`, non-root
  Nginx, SPA fallback, security headers, immutable assets, and `/healthz`.
- Added explicit `BUILDSPHERE_ROOT` resolution for flattened images while
  preserving local monorepo behavior, plus graceful shutdown registration for
  the remaining long-running services.
- Added the BuildSphere-owned Helm chart with 11 Deployments/Services, 13
  token-disabled ServiceAccounts, external Secret/PostgreSQL contracts,
  pre-install/pre-upgrade migrations, hardened pod security, probes, resources,
  optional TLS ingress, and an in-cluster smoke test.
- Added structured Helm verification, values schema controls, no-push CI image
  matrices, hardened image smoke, and a disposable kind
  install/test/upgrade/test orchestrator with an ephemeral PostgreSQL fixture.
- The real cluster gate found and fixed a misspelled backend root variable, a
  PNPM package-local test dependency path, and an assertion mismatch with the
  public auth-provider contract.
- Passed Helm v4.2.3 strict and structural checks for 38 resources with zero
  Secrets and execution disabled by default.
- Built and smoke-tested all 11 images as non-root under read-only-root,
  dropped-capability, no-privilege-escalation restrictions.
- Passed a checksum-verified kind v0.31.0 / Kubernetes v1.34.3 workflow with
  all seven migrations, 11 ready Deployments, frontend/API/database Helm tests,
  revision-two upgrade, repeated migration/test, and cluster cleanup.
- Passed frozen installation, zero-warning lint, every production build, all
  61 automated tests, the 26-file gateway smoke, migrations 001-007 twice,
  Phase 6 and Phase 9 PostgreSQL verifiers, and checksum-verified Terraform
  v1.15.8 static validation.
- Re-ran the Phase 9 official-client kind workflow successfully: two releases,
  healthy rollout, rollback, ownership-matched pruning, credential revocation,
  and complete cluster/kubeconfig cleanup.
- No image was pushed and no external cluster, cloud account, production
  Secret, Terraform state, or production resource was contacted or modified.
- Defined and completed Phase 11 through FR-020, the production observability
  specification, ADR-013, and tickets BS-1101 through BS-1103.
- Added isolated Prometheus registries to all ten backend services with
  Node.js/process metrics, request count and duration, in-flight requests, a
  stable service label, matched-route normalization, and identifier-safe
  unmatched handling.
- Unified Monitoring Service health gauges with the shared metric response and
  added explicit safe proxy route templates at API Gateway.
- Added backend Service discovery metadata and optional, default-disabled
  ServiceMonitor and PrometheusRule resources with six recording rules, three
  alerts, configurable SLO values, and checked-in runbook links.
- Added an eight-panel, data-source-selectable Grafana dashboard and runbooks
  for service down, API errors, and API latency without fixed endpoints or
  credentials.
- Added the Phase 11 structural verifier, Prometheus rule syntax validation in
  CI, backend image metric smoke, and an in-cluster Helm test that scrapes all
  ten backend Services.
- Passed frozen installation, zero-warning lint, every production build, and
  all 63 automated tests. Helm v4.2.3 strict checks, Prometheus v3.12.0 rule
  validation, all 11 hardened images, and the default 38-resource zero-Secret
  chart contract pass.
- Re-ran the 26-file gateway smoke, migrations 001-007, Phase 6 and Phase 9
  PostgreSQL verifiers, Terraform v1.15.8 static validation, Phase 10
  install/test/upgrade/test with backend metrics, and the independent Phase 9
  real-client apply/status/rollback/prune/revocation flow.
- Deleted both disposable kind clusters. No monitoring stack, registry,
  external cluster, cloud account, production Secret, alert receiver, or
  production resource was contacted or modified.

## 2026-07-15

- Defined and completed Phase 12 through FR-021, the runtime reliability and
  network security specification, ADR-014, and tickets BS-1201 through BS-1203.
- Added explicit zero-unavailable rolling updates, a five-second readiness
  settling period, and selector-matched soft hostname topology spreading to all
  11 platform Deployments.
- Added optional selector-matched PDBs with render-time validation that rejects
  singleton and non-disruptable minimum configurations.
- Added optional `autoscaling/v2` HPAs for all 11 workloads with two-to-five
  replica defaults, CPU/memory targets, bounded scale-up, stabilized scale-down,
  and Deployment replica ownership transferred away from Helm.
- Added optional ingress-only NetworkPolicies for all 11 workloads. They encode
  25 exact internal caller edges, chart-test access, configurable public-ingress
  and backend-metrics peers, exact destination ports, and no `ipBlock`, broad
  peer, or egress policy.
- Bumped the BuildSphere chart to `0.3.0`, expanded values/schema/operator
  documentation, added the Phase 12 structured verifier and CI gate, and added
  a two-replica reliability mode to the disposable kind orchestrator.
- Passed Helm v4.2.3 strict and structural checks: the default remains 38
  resources and zero Secrets; opt-in renders produce 11 PDBs, 11 HPAs, and 11
  NetworkPolicies, with unsafe replica, scaling, topology, and ingress settings
  failing validation.
- Passed a checksum-verified kind v0.31.0 / Kubernetes v1.34.3
  install/test/upgrade/test using two replicas for all 11 applications with all
  11 PDBs and NetworkPolicies enabled, seven migrations, backend metrics
  scrapes, and complete cleanup.
- Passed frozen installation, zero-warning lint, every production build, all
  63 automated tests, Prometheus v3.12.0 rule validation, and all 11 current
  non-root/read-only image health and metrics smokes.
- Re-ran the 26-file gateway smoke, migrations 001-007, Phase 6 and Phase 9
  PostgreSQL verifiers, Terraform v1.15.8 static validation, and the independent
  Phase 9 real-client apply/status/rollback/prune/revocation cluster workflow.
- Deleted both disposable kind clusters. No external cluster, Metrics API,
  network plugin, registry, cloud account, production Secret, or production
  resource was contacted or modified.
- Defined and completed Phase 13 through FR-022, the software supply-chain
  security specification, ADR-015, and tickets BS-1301 through BS-1303.
- Bumped the platform chart to `0.4.0` and added fail-closed digest mode for all
  11 Deployments plus migration and test images while retaining the unchanged
  38-resource tag-mode default.
- Pinned every backend/frontend base to an exact digest and added release-time
  OCI version, revision, source, and license identity. Backend runtime layers
  remove bundled npm/Corepack/PNPM/Yarn tools.
- Added the canonical 11-component release inventory, deterministic component
  and bundle evidence builders, digest values, manifest, packaged chart, 11
  CycloneDX SBOMs, and 14-entry checksum verification with six negative cases.
- Added a protected semantic-version GitHub workflow with pinned actions,
  BuildKit maximal provenance/SBOM, blocking Trivy scans, keyless Cosign image
  and evidence signatures, signature verification, and draft release creation.
  Normal CI stays read-only and no-push.
- Passed actionlint `1.7.12`, Phase 13 strict/structural verification, all 11
  rebuilt image checks, and Trivy `0.70.0` with zero HIGH/CRITICAL
  vulnerabilities, zero detected secrets, and 11 valid CycloneDX SBOMs.
- Passed the exact-digest kind install/test/upgrade/test with Phase 12
  reliability controls, seven migrations, and cleanup, as well as the tag-mode
  Phase 12 and independent Phase 9 disposable-cluster regressions.
- Re-ran frozen installation, lint, all builds and 63 tests, PostgreSQL
  migrations/provider/operation checks, the 26-file gateway smoke, Terraform
  v1.15.8 validation, and Prometheus v3.12.0 rule checks successfully.
- No GHCR image, signing certificate, GitHub Release, external cluster, cloud
  account, production Secret, or production resource was created or modified.
