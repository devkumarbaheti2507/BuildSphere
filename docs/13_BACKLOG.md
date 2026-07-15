# Document Information

| Field             | Value                  |
| ----------------- | ---------------------- |
| Document          | Backlog                |
| Version           | 0.1.0                  |
| Status            | Draft                  |
| Author            | BuildSphere Team       |
| Last Updated      | 2026-07-15             |
| Related Documents | 12_ROADMAP.md, specs/* |

---

# Purpose

This file defines implementation tickets for BuildSphere.

# Ticket format

```text
ID:
Title:
Priority:
Milestone:
Owner:
Status:
Description:
Acceptance Criteria:
```

# Phase 1 tickets

## BS-001: Configure workspace build

Priority: High
Milestone: Phase 1
Status: Done

Description:
Ensure root workspace, frontend, backend services, and packages can install and build.

Acceptance criteria:

- `pnpm install` succeeds.
- `pnpm -r build` succeeds.
- CI workflow passes.

## BS-002: Implement shared types package

Priority: High
Milestone: Phase 1
Status: Done

Description:
Define shared TypeScript types for users, projects, pipelines, logs, and suggestions.

Acceptance criteria:

- Types exported from `packages/shared-types`.
- Backend services can import shared types.

## BS-003: Implement Auth Service register and login

Priority: High
Milestone: Phase 1
Status: Done

Description:
Build user registration and login endpoints.

Acceptance criteria:

- `POST /auth/register` works.
- `POST /auth/login` works.
- Passwords are hashed.
- JWTs are returned.

## BS-004: Implement Project Service project CRUD

Priority: High
Milestone: Phase 1
Status: Done

Description:
Build create/list/view project APIs.

Acceptance criteria:

- Authenticated user can create a project.
- User can list owned projects.
- User cannot view another user's project.

## BS-005: Implement API Gateway routing

Priority: High
Milestone: Phase 1
Status: Done

Description:
Forward frontend requests to Auth and Project services.

Acceptance criteria:

- `/api/auth/*` routes to Auth Service.
- `/api/projects/*` routes to Project Service.
- Errors are normalized.

## BS-006: Build frontend auth screens

Priority: High
Milestone: Phase 1
Status: Done

Description:
Create login and signup pages.

Acceptance criteria:

- User can submit signup form.
- User can submit login form.
- Access token is stored safely for MVP.

## BS-007: Build project dashboard

Priority: High
Milestone: Phase 1
Status: Done

Description:
Show created projects and a create-project action.

Acceptance criteria:

- Dashboard lists projects.
- Empty state is shown when no projects exist.

# Phase 2 tickets

## BS-101: Implement template catalog

Priority: High
Milestone: Phase 2
Status: Done

## BS-102: Implement project generation endpoint

Priority: High
Milestone: Phase 2
Status: Done

## BS-103: Generate Dockerfile from template

Priority: High
Milestone: Phase 2
Status: Done

## BS-104: Generate GitHub Actions workflow

Priority: High
Milestone: Phase 2
Status: Done

## BS-105: Generate Kubernetes manifests

Priority: Medium
Milestone: Phase 2
Status: Done

# Phase 3 tickets

## BS-201: Implement pipeline definition model

Priority: High
Milestone: Phase 3
Status: Done

## BS-202: Implement simulated pipeline execution

Priority: High
Milestone: Phase 3
Status: Done

## BS-203: Implement log storage and retrieval

Priority: High
Milestone: Phase 3
Status: Done

## BS-204: Build pipeline timeline UI

Priority: Medium
Milestone: Phase 3
Status: Done

# Phase 4 tickets

## BS-301: Implement rule-based suggestion engine

Priority: High
Milestone: Phase 4
Status: Done

## BS-302: Load prompts from prompts folder

Priority: Medium
Milestone: Phase 4
Status: Done

## BS-303: Build suggestions UI

Priority: Medium
Milestone: Phase 4
Status: Done

# Phase 5 tickets

## BS-401: Implement deployment targets and manifest validation

Priority: High
Milestone: Phase 5
Status: Done

## BS-402: Implement service health aggregation and metrics

Priority: Medium
Milestone: Phase 5
Status: Done

## BS-403: Implement user notifications

Priority: Medium
Milestone: Phase 5
Status: Done

# Release verification

## BS-901: Refresh dependency lockfile and run PostgreSQL integration verification

Priority: High
Milestone: MVP verification
Status: Done

Description:
Install the new `pg` dependency, regenerate `pnpm-lock.yaml`, run the SQL migration against PostgreSQL, and exercise the complete browser workflow.

Verification outcome:
The dependency lockfile was refreshed, frozen installation passed, the SQL migration applied idempotently to PostgreSQL, and the complete gateway workflow passed against durable storage on 2026-07-08. Persisted data was retrieved after an application restart.

## BS-902: Complete screenshot-based responsive UI verification

Priority: Medium
Milestone: MVP verification
Status: Done

Verification outcome:
The complete browser workflow passed from signup through deployment target creation. Desktop and mobile screenshots covered authentication, dashboard, and project views, and automated viewport checks found no page-level horizontal overflow.

# Phase 6 tickets

## BS-501: Add GitHub App OAuth login

Priority: High
Milestone: Phase 6
Status: Done

Description:
Allow a user to authenticate through a GitHub App and receive a normal BuildSphere session.

Acceptance criteria:

- Provider availability is discoverable without exposing secrets.
- Authorization uses signed state and PKCE.
- Callback processing requires a verified GitHub email.
- Existing users are linked by verified email and new users can be created without a local password.
- GitHub provider tokens are encrypted before PostgreSQL storage.
- Frontend login and callback states are complete and tested.

Verification outcome:
The complete Node 22 workspace gate passes for provider discovery, PKCE and signed-state validation, verified-email account creation and linking, encrypted token storage, and disabled-provider behavior. A live GitHub callback completed successfully against the configured local GitHub App on 2026-07-09.

## BS-502: Create GitHub repositories from generated artifacts

Priority: High
Milestone: Phase 6
Status: Done

Acceptance criteria:

- Project ownership and generated artifact selection are enforced by Project Service.
- The connected GitHub user token is refreshed before expiry when possible.
- Repository links are durable and one-to-one with BuildSphere projects.
- Generated files are validated and created or updated serially.
- Publishing can safely retry after partial provider failures.
- Repository creation and file publishing are covered by provider-double API tests.

Verification outcome:
Project ownership, artifact selection, token rotation, serial publishing, partial-failure retry, internal service authentication, unsafe-path rejection, unchanged-file skipping, and workflow-last ordering pass in automated tests. Migration 003 and the PostgreSQL provider verifier pass. A private live repository was created with 10 generated files, corrected through the same durable project link, and republished idempotently without creating another commit or repository.

## BS-503: Track GitHub Actions workflow runs

Priority: High
Milestone: Phase 6
Status: Done

Acceptance criteria:

- Synchronization is restricted to the project owner and linked repository.
- GitHub workflow runs are normalized and durably upserted by GitHub run ID.
- Repeated synchronization updates records without duplication.
- The frontend displays status, branch, run number, trigger, and GitHub URL.
- Provider failures and disconnected projects return structured errors.

Verification outcome:
Workflow-run status normalization, durable PostgreSQL upsert behavior, repeated synchronization without duplicates, project-owner enforcement, internal API behavior, and frontend compilation pass. Live synchronization persisted the repository's push runs, and corrected run 10 completed with a `success` conclusion.

# Phase 7 tickets

## BS-601: Generate configurable Helm charts

Priority: High
Milestone: Phase 7
Status: Done

Description:
Allow Kubernetes projects to optionally generate a standard Helm chart through
the existing project artifact workflow.

Acceptance criteria:

- Helm is a supported packaging selection that requires Kubernetes.
- Template resolution follows saved tool selections.
- Generated chart files include Chart metadata, values, helpers, Deployment,
  Service, Ingress, and installation notes.
- BuildSphere placeholders resolve without consuming Helm expressions.
- Raw Kubernetes validation excludes Helm source templates.
- Generated CI checks the optional chart structure.
- Project Service, Deployment Service, frontend, and full workspace regression
  tests pass.

Verification outcome:
The generated catalog follows saved selections, Helm requires Kubernetes, and
Helm-enabled projects produce a complete seven-file chart in a 17-file default
bundle. Frozen installation, lint, every production build, all 41 automated
tests, and the complete memory-mode gateway smoke passed on 2026-07-10. The
smoke retained the existing seven pipeline stages, 14 logs, deployment
validation, suggestions, eight health checks, and four notifications. A
checksum-verified Helm v4.2.2 binary then passed strict lint and template
rendering. The same 17-file workflow passed against PostgreSQL, persisted
through an application restart, and remained compatible with the Phase 6
PostgreSQL provider verifier.

# Phase 8 tickets

## BS-701: Generate safe AWS EKS Terraform configuration

Priority: High
Milestone: Phase 8
Status: Done

Description:
Allow Kubernetes projects to optionally generate a disabled-by-default AWS EKS
Terraform root module through the existing artifact workflow.

Acceptance criteria:

- `infrastructure/terraform-aws-eks` is supported and requires Kubernetes.
- The generated root module includes versions, provider configuration,
  variables, VPC/EKS modules, outputs, example values, backend guidance, ignore
  rules, and a README.
- Provider and registry module dependencies are explicitly versioned.
- Cluster creation defaults to disabled and access inputs are explicit.
- No generated file contains AWS credentials or an active remote-state backend.
- Generated CI runs only safe Terraform format/init/validate checks.
- Official Terraform CLI formatting and static validation pass.
- Phase 0-7 tests and smoke workflows remain green.

Verification outcome:
The wizard, shared contracts, API schema, dependency checks, generator, and
generated workflow support `infrastructure/terraform-aws-eks`. A selected
project emits the specified nine-file module and a project without the tool
emits no Terraform path. On 2026-07-10, frozen installation, zero-warning lint,
all builds, and all 41 tests passed. A checksum-verified Terraform v1.15.8
binary passed formatting, backend-disabled initialization of VPC `6.6.1`, EKS
`21.24.0`, and AWS provider `6.54.0`, plus static validation without AWS
credentials. The 26-file PostgreSQL gateway smoke and Phase 6 provider verifier
also passed; no plan, apply, destroy, AWS call, or cluster change was made.

# Phase 9 tickets

## BS-801: Inspect Kubernetes connections and build deployment plans

Priority: High
Milestone: Phase 9
Status: Done

Description:
Accept kubeconfig ephemerally, persist only a redacted connection summary, and
build an explainable non-executing resource plan from validated manifests.

Acceptance criteria:

- The official Kubernetes Node client parses kubeconfig input.
- Invalid or incomplete current-context references return structured errors.
- Responses and target records contain no token, password, key, certificate,
  certificate-authority data, auth-provider secret, or exec arguments.
- Draft and inspected deployment targets remain user-scoped.
- Plans require an inspected target, reject invalid manifests and populated
  Secrets, and return ordered resource identities.
- Plans explicitly report that they are not executable and made no cluster
  request.
- Frontend, API, repository, smoke, and Phase 0-8 regression tests pass.

Verification outcome:
The official client parses kubeconfig after a structured local-file-reference
guard. Target records contain only allowlisted summaries, and offline plans
order four generated resources without constructing a Kubernetes API client.
On 2026-07-11, frozen install, lint, every build, all 46 tests, the 26-file
PostgreSQL gateway smoke, Phase 6 PostgreSQL verifier, Terraform static
validation, and desktop/mobile browser checks passed. No cluster request or
resource mutation occurred.

## BS-802: Execute an approved Kubernetes deployment

Priority: High
Milestone: Phase 9
Status: Done

Description:
Define approved credential retention, audit, idempotency, timeout, retry, and
server-side apply behavior, then validate it against an explicit test cluster.

Acceptance criteria:

- Runtime execution fails closed without a dedicated encryption key, exact
  server allowlist, and allowed environment.
- Credential retention is explicit, encrypted, revocable, and separated from
  public target metadata.
- Artifact ownership and exact manifest digest are verified server-side.
- Approval is owner-scoped, expires after five minutes, and is single use.
- Idempotency and one-active-operation-per-target rules are durable.
- Execution allows only the target namespace and constrained resource kinds.
- Existing resources require matching BuildSphere ownership, and server-side
  apply uses `force=false`.
- Timeouts, bounded transient retries, safe errors, audit history, and
  notifications are covered by tests.

Verification outcome:
Execution fails closed unless every required policy value is configured.
Provider-double tests cover minimized target-bound encryption, exact server and
environment policy, dynamic-auth rejection, namespace and kind restrictions,
ownership prechecks, non-forced server-side apply, retries, stale-credential
approval invalidation, idempotency, and target concurrency. The PostgreSQL
verifier confirms durable credential, approval, and operation behavior. A real
disposable kind cluster accepted two approved releases through the official
client, with ownership labels confirmed directly from the API.

## BS-803: Observe and roll back Kubernetes deployments

Priority: High
Milestone: Phase 9
Status: Done

Description:
Persist deployment operations, observe workload rollout status, and provide a
bounded rollback workflow for resources owned by BuildSphere.

Acceptance criteria:

- Operations and resource outcomes remain owner scoped and durable.
- Refresh performs read-only Kubernetes requests and returns summarized status.
- Rollback requires a separate expiring approval and prior successful release.
- The prior snapshot is reapplied through the same execution policy.
- Only newer, namespaced, ownership-matched resources can be deleted.
- Namespaces and cluster-scoped resources cannot be deleted.
- PostgreSQL, provider-double, disposable-cluster, browser, and all earlier
  phase regression gates pass.

Verification outcome:
Operations expose only summarized resource and rollout state. Provider-double
tests cover active-release resolution after rollback and pruning only a newer,
namespaced, ownership-matched resource. The real kind workflow observed a
healthy second release, separately approved rollback to the first release,
deleted only the newly introduced ConfigMap, revoked the credential, and left
no disposable cluster. All 59 tests, the full gateway smoke, Phase 6 and Phase 9
PostgreSQL verifiers, Terraform validation, and desktop/mobile browser checks
pass.

# Phase 10 tickets

## BS-1001: Build production service images

Priority: High
Milestone: Phase 10
Status: Done

Description:
Replace the standalone service Docker stubs with reproducible images that
understand the PNPM workspace and run only built production output.

Acceptance criteria:

- One backend Dockerfile builds all ten backend services by explicit build
  argument and immutable service package name.
- Workspace packages are built before a production-only deploy directory is
  created.
- The runtime is non-root, has a health check, preserves signal handling, and
  includes only required templates, prompts, and migration assets.
- The frontend uses a multi-stage build, same-origin `/api`, SPA fallback, and
  a non-root read-only web runtime.
- `.dockerignore` excludes secrets, VCS data, dependencies, build output, and
  local caches.

Verification outcome:
All ten backend images and the frontend build from the repository root. Every
image starts as a declared non-root user under read-only-root,
no-privilege-escalation, dropped-capability smoke restrictions and reaches its
health endpoint.

## BS-1002: Package BuildSphere as a Helm release

Priority: High
Milestone: Phase 10
Status: Done

Description:
Create the Helm chart used to deploy BuildSphere itself to a controlled
Kubernetes staging namespace.

Acceptance criteria:

- The chart renders all ten backend Deployments/Services and the frontend.
- A pre-install/pre-upgrade Job runs migrations with bounded retry behavior.
- Runtime secrets and PostgreSQL remain external and no `Secret` resource is
  rendered.
- Workloads use non-root pod/container security, read-only root filesystems,
  disabled service-account token mounting, probes, resources, and graceful
  termination.
- Optional ingress supports one host, `/api` routing, and operator-owned TLS.
- Kubernetes execution defaults to disabled and requires explicit policy when
  enabled.

Verification outcome:
Helm v4.2.3 strict lint and structural parsing pass for 11 Deployments, 11
Services, 13 token-disabled ServiceAccounts, one pre-install/pre-upgrade
migration Job, one test Pod, optional ingress, and zero rendered Secrets.

## BS-1003: Verify production packaging and compatibility

Priority: High
Milestone: Phase 10
Status: Done

Description:
Add deterministic local and CI verification for images and rendered Kubernetes
resources while retaining all earlier regression gates.

Acceptance criteria:

- A verifier runs Helm strict lint and parses rendered YAML structurally.
- CI runs frozen installation, lint, build, tests, packaging verification, and
  no-push image builds.
- Images start and answer their health endpoints in a local smoke environment.
- A disposable-cluster chart install validates migration, rollout, routing,
  and cleanup when Docker/kind are available.
- Phase 0-9 verification remains green and no external deployment occurs.

Verification outcome:
The full workspace gate passes with 61 tests. Image smoke, the 38-resource
packaging verifier, and a kind v0.31.0 install/test/upgrade/test cycle pass with
all seven migrations and 11 ready Deployments. Gateway, Phase 6/Phase 9
PostgreSQL, Terraform, and Phase 9 real-client regressions also pass. CI builds
all images without push, and no external environment was modified.

# Phase 11 tickets

## BS-1101: Expose shared service metrics

Priority: High
Milestone: Phase 11
Status: Done

Description:
Instrument every backend service with one isolated Prometheus registry,
standard runtime metrics, and bounded HTTP RED metrics.

Acceptance criteria:

- Every backend exposes `GET /metrics` with the Prometheus content type.
- Request count, duration histogram, in-flight requests, and runtime metrics
  carry a stable service label.
- Matched route templates prevent IDs, query values, and unmatched raw paths
  from entering labels.
- Monitoring Service includes its aggregate health gauges in the unified
  response.
- Shared unit tests and service API tests cover collection and redaction.

Outcome:
Service Core installs one isolated registry per Express app, all ten backend
factories expose `/metrics`, proxy routes provide explicit templates, and tests
cover the content type, metric families, route normalization, redaction,
scrape exclusion, registry isolation, and Monitoring Service composition.

## BS-1102: Add Prometheus discovery and alert rules

Priority: High
Milestone: Phase 11
Status: Done

Description:
Extend the BuildSphere Helm chart with internal scrape metadata and optional
Prometheus Operator resources.

Acceptance criteria:

- Only backend Services are selected as metric targets.
- Operator resources remain disabled by default and require no CRDs for the
  default install.
- ServiceMonitor interval, timeout, labels, and namespace are configurable.
- PrometheusRule recording and alerting rules cover availability, server-error
  ratio, and latency without embedding credentials or environment endpoints.
- Phase 10 chart contracts remain green.

Outcome:
Backend Services now carry bounded discovery metadata. The default chart emits
no operator CRDs; opt-in rendering creates one ServiceMonitor and one
PrometheusRule with six recording rules and three alerts. Helm strict lint,
schema-negative checks, and Prometheus rule validation pass.

## BS-1103: Define SLO operations and verify compatibility

Priority: High
Milestone: Phase 11
Status: Done

Description:
Provide the dashboard, service-level objectives, alert response documentation,
and complete regression evidence required to operate the metric contract.

Acceptance criteria:

- A versioned Grafana dashboard visualizes the documented signals.
- SLO thresholds and measurement windows are explicit and match alert rules.
- Every alert links to a checked-in response runbook.
- CI runs Phase 11 structural verification.
- Unit, integration, image, Helm, PostgreSQL, Terraform, and disposable-cluster
  regressions remain green.

Outcome:
The eight-panel Grafana dashboard, explicit API availability/latency objectives,
three alert runbooks, CI verifier, hardened image metric smoke, and ten-service
cluster scrape test are checked in. All 63 tests and the complete Phase 0-10
regression suite pass without modifying an external environment.

# Phase 12 tickets

## BS-1201: Add rollout and disruption safeguards

Priority: High
Milestone: Phase 12
Status: Done

Description:
Make application updates and voluntary disruptions predictable across local
and multi-node Kubernetes installations.

Acceptance criteria:

- All application Deployments define zero-unavailable rolling updates, bounded
  surge, and a readiness settling period.
- All application Deployments use a selector-matched soft hostname topology
  spread constraint.
- The chart can optionally render one `policy/v1` PodDisruptionBudget per
  workload.
- Chart validation rejects disruption budgets that cannot tolerate one
  voluntary disruption.

Outcome:
All 11 Deployments now use zero-unavailable rolling updates, a five-second
readiness settling period, and selector-matched soft hostname spreading.
Opt-in PDBs use exact selectors and fail rendering for singleton or
non-disruptable minimum configurations. A two-replica disposable-cluster
install and upgrade passed with every PDB present.

## BS-1202: Add bounded horizontal autoscaling

Priority: High
Milestone: Phase 12
Status: Done

Description:
Let an operator opt into Kubernetes-owned horizontal scaling without adding a
Metrics API dependency to the default release.

Acceptance criteria:

- The chart can optionally render one `autoscaling/v2` HPA per application
  Deployment.
- Minimum and maximum replicas, CPU and memory targets, and stabilization
  windows are bounded and schema-validated.
- Deployments omit `spec.replicas` while autoscaling is enabled.
- The chart documents the operator-owned Metrics API prerequisite.

Outcome:
Opt-in `autoscaling/v2` HPAs target all 11 Deployments with bounded two-to-five
replica defaults, CPU and memory utilization targets, responsive scale-up, and
stabilized 25-percent scale-down. Autoscaled Deployments omit `spec.replicas`.
Schema, behavior, ownership, and invalid-bound checks pass; runtime metrics
scaling remains correctly dependent on an operator-installed Metrics API.

## BS-1203: Isolate ingress and verify compatibility

Priority: High
Milestone: Phase 12
Status: Done

Description:
Encode BuildSphere's reviewed ingress graph and prove compatibility with all
completed phases.

Acceptance criteria:

- The chart can optionally render one ingress-only NetworkPolicy per
  application workload.
- Internal peers use exact chart, release, and component selectors.
- External ingress-controller and metrics-collector selectors are
  configurable and limited to their required destinations.
- The chart does not emit unrestricted peers, `ipBlock`, or egress policy.
- CI runs structured Phase 12 verification and the complete Phase 0-11
  regression suite remains green.

Outcome:
Opt-in policies select all 11 workloads, preserve exactly 25 current internal
caller edges plus chart-test access, allow configured ingress controllers only
to Frontend/API Gateway, and allow configured collectors only to backends.
Every policy is ingress-only, port-bounded, and contains no `ipBlock`, broad
peer, or egress section. CI runs the verifier; the complete workspace, image,
PostgreSQL, Terraform, gateway, and two disposable-cluster regressions pass.

# Phase 13 tickets

## BS-1301: Bind images and Helm releases to immutable digests

Priority: High
Milestone: Phase 13
Status: Done

Description:
Add reviewable OCI source metadata to every BuildSphere runtime image and an
explicit Helm mode that resolves every workload, migration, and test image by
component digest.

Acceptance criteria:

- Backend and frontend runtime images expose version, revision, source, and
  license OCI labels supplied by release builds.
- Default chart behavior remains tag-based for existing local workflows.
- Digest mode requires all eleven exact `sha256` values.
- No workload, migration, or test image silently falls back to a tag in digest
  mode.
- Helm schema, strict lint, positive render, and negative render tests pass.

Outcome:
All backend and frontend release targets use digest-pinned base images and
release-supplied OCI identity. Chart `0.4.0` preserves tag mode for local use
and adds explicit fail-closed digest mode for all 11 application images plus
the migration and chart-test consumers. Strict lint, structured positive
renders, malformed/missing digest failures, and an exact-digest disposable
kind install/upgrade pass.

## BS-1302: Scan, attest, and keylessly sign release images

Priority: High
Milestone: Phase 13
Status: Done

Description:
Create a separately authorized semantic-version release workflow for GHCR
images with pinned automation, BuildKit attestations, CycloneDX SBOMs,
blocking vulnerability/secret scans, and GitHub OIDC signatures.

Acceptance criteria:

- Normal CI has no registry write or OIDC authority.
- Every action reference is pinned to a full commit SHA.
- A checksum-pinned scanner blocks HIGH/CRITICAL findings.
- BuildKit emits SBOM and maximal provenance attestations for each image.
- Cosign signs only the immutable digest after scanning succeeds.
- Exactly one validated component record and SBOM is retained per image.

Outcome:
The protected semantic-version workflow builds 11 GHCR targets with maximal
BuildKit provenance and SBOM attestations, scans immutable references with
checksum-pinned Trivy `0.70.0`, emits CycloneDX SBOMs, and signs accepted
digests keylessly through GitHub OIDC. Normal CI remains read-only and all
workflow actions are pinned. Local image verification rebuilt and scanned all
11 images with zero HIGH/CRITICAL vulnerability or secret findings.

## BS-1303: Certify one complete release candidate

Priority: High
Milestone: Phase 13
Status: Done

Description:
Aggregate and verify all component evidence, package the chart, emit signed
release metadata and digest values, and present the result as a draft release
without deploying it.

Acceptance criteria:

- Missing, duplicate, unknown, inconsistent, or malformed component evidence
  fails certification.
- The manifest binds source, image digests, SBOM hashes, chart hash, scan
  policy, and signing identity.
- Checksums cover every release file and both manifest and checksums have
  keyless verification bundles.
- A draft GitHub Release is the only publication result.
- Focused and complete Phase 0-12 regression gates pass without external
  publication or deployment.

Outcome:
The evidence builder rejects missing, duplicate, unknown, inconsistent,
malformed-digest, and invalid-SBOM inputs, then deterministically emits the
complete 11-component manifest, digest values, chart archive, SBOM set, and 14
checksums. The workflow verifies image signatures, signs the manifest and
checksums, and targets a draft release only. Focused and complete Phase 0-12
regressions pass locally; no GHCR push, OIDC signing request, GitHub Release, or
external deployment was performed.
