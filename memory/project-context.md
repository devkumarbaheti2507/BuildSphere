# BuildSphere Project Context

BuildSphere is an AI-assisted Developer Experience Platform for designing, generating, deploying, observing, and improving microservice applications.

Current implementation status:

- Local-first MVP code is implemented through roadmap Phase 6.
- Local and GitHub App authentication, project repository publishing, GitHub Actions synchronization, projects, generation, pipelines, logs, suggestions, deployment targets, monitoring, notifications, and frontend workflows are present.
- Frozen dependency installation, lint, production builds, and automated tests pass.
- Memory and PostgreSQL gateway smoke workflows pass.
- Live migration, persistence after restart, and desktop/mobile browser verification are complete.
- Phase 6 migrations, PostgreSQL provider persistence, token rotation, workflow-run upserts, and cleanup pass with provider doubles.
- Database-backed services use a shared idempotent graceful-shutdown helper.

Primary goal now:

Use the project knowledge graph and presentation guide to learn and explain the
implemented system before selecting the next post-Phase 6 milestone.

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
