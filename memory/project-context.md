# BuildSphere Project Context

BuildSphere is an AI-assisted Developer Experience Platform for designing,
generating, deploying, observing, and improving microservice applications.

Current implementation status:

- Phases 0-11 are complete. Phase 9 provides inspected/planned/approved
  Kubernetes apply, durable status, and bounded rollback. Phase 10 packages
  BuildSphere itself for controlled staging. Phase 11 defines the production
  metric, SLO, dashboard, alert, and response baseline.
- Local and GitHub App authentication, project repository publishing, GitHub
  Actions synchronization, projects, generation, pipelines, logs, suggestions,
  deployment targets, monitoring, notifications, and frontend workflows are
  implemented.
- Selection-aware generation supports raw Kubernetes, optional Helm, and
  disabled-by-default AWS EKS Terraform source.
- Ten backend services share one monorepo-aware production Dockerfile. The
  frontend uses a separate non-root Nginx image. All 11 images pass hardened
  local health smoke checks.
- `infrastructure/helm/buildsphere` deploys all 11 components, references an
  external Secret and PostgreSQL, runs pre-install/pre-upgrade migrations, and
  applies non-root/read-only/probe/resource safeguards. Backend Services carry
  internal metric discovery metadata; ServiceMonitor and PrometheusRule remain
  optional and disabled by default.
- All ten backends expose isolated Node.js/process and bounded HTTP RED metrics.
  Monitoring Service combines them with aggregate health gauges. The repository
  also owns an eight-panel Grafana dashboard, explicit API SLOs, six recording
  rules, three alerts, and three runbooks.
- Helm v4.2.3 strict and structural validation passes for 38 rendered resources
  with zero Secrets and deployment execution disabled by default.
- A checksum-verified kind v0.31.0 / Kubernetes v1.34.3 workflow passed seven
  migrations, 11 ready Deployments, frontend/API/database Helm tests, upgrade,
  repeated migration/test, and cleanup.
- Frozen installation, zero-warning lint, all production builds, and all 63
  automated tests pass.
- The 26-file gateway smoke, migrations 001-007, Phase 6 and Phase 9 PostgreSQL
  verifiers, Terraform v1.15.8 static validation, and the Phase 9 real
  Kubernetes apply/status/rollback/prune/revocation regression remain green.
- Database-backed services use a shared idempotent graceful-shutdown helper.

Primary goal now:

Select and specify Phase 12. Strong candidates are runtime reliability and
network security, production data/secret operations, or supply-chain release
security. The choice requires requirements, an ADR where architecture changes,
a specification, and backlog tickets before implementation.

Important boundary:

Phase 10 is staging-deployable packaging and Phase 11 is an observability
contract, not an operated production environment. CI does not push images,
deploy, install a monitoring stack, or configure receivers. No external
cluster, cloud account, production Secret, registry, remote state, or
production resource has been modified.

Learning pack:

- `docs/15_PROJECT_KNOWLEDGE_GRAPH.md`
- `docs/project-knowledge-graph.json`
- `docs/16_PRESENTATION_AND_LEARNING_GUIDE.md`

Default stack:

- React + Vite + TypeScript frontend.
- Node.js + TypeScript + Express backend services.
- PostgreSQL for durable data.
- Docker/Compose for local infrastructure and production images.
- GitHub Actions for CI and no-push image builds.
- Kubernetes and Helm for controlled deployment packaging.
- Prometheus metrics and operator-compatible monitoring assets.
- Optional generated AWS EKS Terraform source with no apply authority.
