# BuildSphere Project Context

BuildSphere is an AI-assisted Developer Experience Platform for designing,
generating, deploying, observing, and improving microservice applications.

Current implementation status:

- Phases 0-14 are complete. Phase 9 provides inspected/planned/approved
  Kubernetes apply, durable status, and bounded rollback. Phase 10 packages
  BuildSphere itself for controlled staging. Phase 11 defines the production
  metric, SLO, dashboard, alert, and response baseline.
  Phase 12 adds safe rollout/topology defaults and optional disruption,
  autoscaling, and ingress-isolation controls. Phase 13 adds immutable image
  identity, scan/SBOM/signing gates, digest-only Helm releases, and
  deterministic release certification. Phase 14 adds AMD64/ARM64 release
  indexes, a personal PostgreSQL/TLS prerequisite chart, guarded Secret
  bootstrap, and a conservative single-node K3s profile.
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
- Certified chart values require all 11 immutable image digests and cover
  application Deployments, migrations, and chart tests without tag fallback.
  `infrastructure/release/components.json` is the canonical component set.
- Certified release schema 2 binds the exact AMD64/ARM64 platform set and 22
  CycloneDX SBOMs to eleven immutable OCI index digests. Legacy schema 1 remains
  supported only for frozen Phase 13 regression fixtures.
- `infrastructure/helm/buildsphere-personal-prerequisites` installs persistent
  PostgreSQL and optional namespaced TLS resources without rendering a Secret.
  `infrastructure/deployment/free-tier` provides the one-node application
  values used after certified digest values.
- All 11 Deployments use zero-unavailable rolling updates and soft hostname
  spreading. The chart can optionally emit selector-matched PDBs,
  `autoscaling/v2` HPAs, and exact ingress-only NetworkPolicies while retaining
  its 38-resource default render.
- All ten backends expose isolated Node.js/process and bounded HTTP RED metrics.
  Monitoring Service combines them with aggregate health gauges. The repository
  also owns an eight-panel Grafana dashboard, explicit API SLOs, six recording
  rules, three alerts, and three runbooks.
- Helm v4.2.3 strict and structural validation passes for 38 rendered resources
  with zero Secrets and deployment execution disabled by default.
- A checksum-verified kind v0.31.0 / Kubernetes v1.34.3 workflow passed seven
  migrations, two replicas for all 11 Deployments, all 11 PDBs and
  NetworkPolicies, frontend/API/database/metrics Helm tests, upgrade, repeated
  migration/test, and cleanup.
- Frozen installation, zero-warning lint, all production builds, and all 63
  automated tests pass.
- All 11 rebuilt images pass Trivy `0.70.0` with zero HIGH/CRITICAL
  vulnerabilities and zero secrets, produce CycloneDX SBOMs, and pass OCI
  identity/non-root/runtime-minimization checks. Exact-digest kind
  install/test/upgrade/test also passes.
- The 26-file gateway smoke, migrations 001-007, Phase 6 and Phase 9 PostgreSQL
  verifiers, Terraform v1.15.8 static validation, and the Phase 9 real
  Kubernetes apply/status/rollback/prune/revocation regression remain green.
- Database-backed services use a shared idempotent graceful-shutdown helper.

Primary goal now:

Recover and certify the first personal free-tier release candidate one explicit
step at a time, then continue deployment. Commit the Cosign compatibility fix,
confirm normal CI, and use a fresh `v0.5.1` tag only with approval. Create the
owner's selected free account and VM only with approval. Do not silently trigger
a release, change GitHub package visibility, provision cloud resources, request
a certificate, or mutate an external cluster.

Important boundary:

Phases 10-14 provide staging-deployable packaging, observability/runtime
controls, an authorized release-certification path, and a verified personal
installation profile, not an operated production environment. Normal CI does
not push images or request OIDC. The live `v0.5.0` candidate built, scanned, and
pushed all eleven multi-platform indexes but failed before signing or draft
release creation because the workflow used Cosign's obsolete singular
`--annotation` option. The workflow now uses `--annotations`, pins Cosign
`v3.0.6`, and passes Phase 13, Phase 14, and actionlint checks. Keep `v0.5.0` as
failed audit evidence and use `v0.5.1` for the recovery candidate. No public
certificate, cloud account, external cluster, remote state, or production
resource was created or modified.

Learning pack:

- `docs/15_PROJECT_KNOWLEDGE_GRAPH.md`
- `docs/project-knowledge-graph.json`
- `docs/16_PRESENTATION_AND_LEARNING_GUIDE.md`

Default stack:

- React + Vite + TypeScript frontend.
- Node.js + TypeScript + Express backend services.
- PostgreSQL for durable data.
- Docker/Compose for local infrastructure and production images.
- GitHub Actions for read-only CI and protected release automation.
- Kubernetes and Helm for controlled deployment packaging.
- K3s, Traefik, and a separate PostgreSQL prerequisite release for the personal
  profile.
- Trivy, CycloneDX, BuildKit provenance, and Cosign for release certification.
- Prometheus metrics and operator-compatible monitoring assets.
- Optional generated AWS EKS Terraform source with no apply authority.
