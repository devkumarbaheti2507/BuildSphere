# Next Session

Recommended next task:

Define Phase 14. Phase 13 software supply-chain security and release
certification is complete locally; no Phase 14 requirement or ticket is yet
approved.

Immediate tasks:

1. Specify production data and secret operations: external Secret integration
   and rotation, PostgreSQL high availability, backup/restore, disaster
   recovery, and a bounded staging-validation contract.
2. Add FR-023, an ADR, a Phase 14 spec, roadmap milestone, and backlog tickets
   before implementation.
3. Keep `pnpm verify`, Phase 10-13 structural gates, `verify:phase13:images`,
   gateway/PostgreSQL/Terraform/Prometheus regressions, and both controlled
   Kubernetes paths green.
4. Require explicit approval and environment configuration before any live
   tag, GHCR push, OIDC signing, GitHub Release, external Secret, database, or
   staging-cluster operation.

Current evidence:

- Phases 0-13 are complete.
- Frozen install, zero-warning lint, every production build, and all 63 tests
  pass.
- All 11 production images build and become healthy under non-root,
  read-only-root, dropped-capability smoke restrictions.
- Helm v4.2.3 strict/structural verification passes for 38 resources: 11
  Deployments, 11 Services, 13 ServiceAccounts, one migration Job, one test
  Pod, and zero Secrets.
- A disposable kind v0.31.0 / Kubernetes v1.34.3 install passed all seven
  migrations, 11 ready Deployments, frontend/API/database tests, upgrade,
  repeated migration/test, and cluster cleanup.
- The 26-file gateway smoke, migrations 001-007, Phase 6 provider persistence,
  Phase 9 encrypted operations/rollback persistence, Terraform v1.15.8 static
  validation, and the Phase 9 real-client cluster workflow remain green.
- CI runs the workspace gate, chart verification, and no-push builds for all 11
  images.
- All ten backends expose bounded runtime/HTTP metrics. Phase 11 validation
  passes for one optional ServiceMonitor, one PrometheusRule, six recording
  rules, three alerts, eight dashboard panels, and three linked runbooks.
- Prometheus v3.12.0 validates the rendered rules. The Phase 10 image and kind
  gates verify every backend metrics endpoint; the chart's default 38-resource,
  zero-Secret, no-monitoring-CRD render remains intact.
- Phase 12 verification passes for zero-unavailable rollout and soft topology
  spreading on all 11 Deployments, 11 optional PDBs, 11 HPAs, 11 ingress-only
  policies, 25 exact caller edges, HPA replica ownership, and unsafe-value
  failures.
- The Phase 12 kind mode passed with 22 application replicas, all 11 PDBs and
  NetworkPolicies, seven migrations, install/test/upgrade/test, and cleanup.
- Phase 13 verification passes for chart `0.4.0`, all 11 digest references,
  migration/test reuse, 21 pinned action references, checksum-pinned tools,
  deterministic evidence, 14 checksums, and six hostile evidence cases.
- All 11 images rebuilt with exact base digests and OCI identity. Trivy
  `0.70.0` reported zero HIGH/CRITICAL vulnerabilities and zero secrets and
  generated 11 CycloneDX SBOMs.
- A separate digest-mode kind lifecycle installed every application,
  migration, and test image by exact local digest with the Phase 12 reliability
  controls, then completed migration/test/upgrade/retest and cleanup.
- No live release tag was triggered. No image was pushed, no signing
  certificate was requested, and no GitHub Release was created.

Production boundaries still open:

- Live GHCR authorization, protected-environment approval, OIDC signature and
  attestation verification, and draft-release review in the real repository.
- External Secret integration and rotation, PostgreSQL high availability,
  backup/restore, and disaster recovery.
- Multi-zone hard scheduling, ingress controller, Metrics API, enforcing CNI,
  DNS, certificate automation, autoscaling load tuning, and capacity testing.
- Operating and retaining Prometheus/Grafana/Alertmanager data, centralized
  logging, distributed tracing, environment-specific alert routing, and
  on-call ownership.
- Approved external staging deployment and production promotion after draft
  release review.
- Terraform plan/apply/state and cloud account operations remain out of scope
  until separately approved.

Node `v22.23.1` remains preferred via `.nvmrc`; Node `v24.18.0` also passes the
latest complete gate.
