# BuildSphere Project Context

BuildSphere is an AI-assisted Developer Experience Platform for designing, generating, deploying, observing, and improving microservice applications.

Current implementation status:

- Local-first platform code is implemented through roadmap Phase 8.
- Local and GitHub App authentication, project repository publishing, GitHub Actions synchronization, projects, generation, pipelines, logs, suggestions, deployment targets, monitoring, notifications, and frontend workflows are present.
- Frozen dependency installation, lint, production builds, and automated tests pass.
- Memory and PostgreSQL gateway smoke workflows pass.
- Live migration, persistence after restart, and desktop/mobile browser verification are complete.
- Phase 6 migrations, PostgreSQL provider persistence, token rotation, workflow-run upserts, and cleanup pass with provider doubles.
- Phase 7 adds selection-aware generation and optional Helm chart packaging for
  Kubernetes projects without performing cluster operations.
- Phase 7 strict Helm lint/template rendering and its PostgreSQL persistence
  checks pass.
- Phase 8 adds optional, disabled-by-default AWS EKS Terraform generation with
  exact VPC/EKS module pins, a Kubernetes dependency, generated static CI
  checks, and no cloud execution authority.
- Checksum-verified Terraform v1.15.8 format/init-without-backend/validate, the
  26-file PostgreSQL gateway smoke, all 41 tests, and the Phase 6 provider
  verifier pass.
- Database-backed services use a shared idempotent graceful-shutdown helper.

Primary goal now:

Select and specify the next post-Phase 8 milestone while keeping the completed
Phase 0-8 verification baseline green.

Learning pack:

- `docs/15_PROJECT_KNOWLEDGE_GRAPH.md`
- `docs/project-knowledge-graph.json`
- `docs/16_PRESENTATION_AND_LEARNING_GUIDE.md`

Default stack:

- React + Vite + TypeScript frontend.
- Node.js + TypeScript backend services.
- PostgreSQL for durable data.
- Redis for cache and future lightweight queues.
- Docker for local infrastructure.
- GitHub Actions for CI.
- Kubernetes manifests, optional Helm charts, and optional AWS EKS Terraform
  source for deployment and infrastructure configuration.
