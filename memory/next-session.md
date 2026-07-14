# Next Session

Recommended next task:

Choose and specify the first post-Phase 10 production-hardening milestone.
Phase 10 is complete; there is no approved Phase 11 ticket yet.

Immediate tasks:

1. Decide whether Phase 11 starts with supply-chain/release security,
   production observability/SLOs, or runtime reliability/data operations.
2. Add requirements, an ADR when architecture changes, a spec, roadmap
   milestone, and backlog tickets before implementation.
3. Keep `pnpm verify`, `pnpm verify:phase10`,
   `pnpm verify:phase10:images`, the gateway smoke, Terraform validation, and
   Phase 6/Phase 9 PostgreSQL verifiers green.
4. Use `pnpm verify:phase10:kind` for local chart regressions and delete every
   disposable cluster. Keep external deployment behind explicit approval.

Current evidence:

- Phases 0-10 are complete.
- Frozen install, zero-warning lint, every production build, and all 61 tests
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

Production boundaries still open:

- Registry selection, authentication, immutable digest promotion, signing,
  SBOMs, vulnerability scanning, and provenance.
- External Secret integration and rotation, PostgreSQL high availability,
  backup/restore, and disaster recovery.
- NetworkPolicy, pod disruption budgets, autoscaling, anti-affinity, ingress
  controller, DNS, certificate automation, and capacity testing.
- Centralized logging, metrics collection, dashboards, alerts, tracing, SLOs,
  and on-call/release runbooks.
- Approved external staging deployment and production release certification.
- Terraform plan/apply/state and cloud account operations remain out of scope
  until separately approved.

Node `v22.23.1` remains preferred via `.nvmrc`; Node `v24.18.0` also passes the
latest complete gate.
