# Next Session

Recommended next task:

Choose and specify Phase 12. Phase 11 production observability and SLO baseline
is complete; there is no approved Phase 12 ticket yet.

Immediate tasks:

1. Decide whether Phase 12 starts with runtime reliability/network security,
   production data and secret operations, or supply-chain/release security.
2. Add requirements, an ADR when architecture changes, a spec, roadmap
   milestone, and backlog tickets before implementation.
3. Keep `pnpm verify`, `pnpm verify:phase10`, `pnpm verify:phase11`,
   `pnpm verify:phase10:images`, the gateway smoke, Terraform validation, and
   Phase 6/Phase 9 PostgreSQL verifiers green.
4. Use `pnpm verify:phase10:kind` for local chart regressions and delete every
   disposable cluster. Keep external deployment behind explicit approval.

Current evidence:

- Phases 0-11 are complete.
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

Production boundaries still open:

- Registry selection, authentication, immutable digest promotion, signing,
  SBOMs, vulnerability scanning, and provenance.
- External Secret integration and rotation, PostgreSQL high availability,
  backup/restore, and disaster recovery.
- NetworkPolicy, pod disruption budgets, autoscaling, anti-affinity, ingress
  controller, DNS, certificate automation, and capacity testing.
- Operating and retaining Prometheus/Grafana/Alertmanager data, centralized
  logging, distributed tracing, environment-specific alert routing, and
  on-call ownership.
- Approved external staging deployment and production release certification.
- Terraform plan/apply/state and cloud account operations remain out of scope
  until separately approved.

Node `v22.23.1` remains preferred via `.nvmrc`; Node `v24.18.0` also passes the
latest complete gate.
