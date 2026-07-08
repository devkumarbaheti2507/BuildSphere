# BuildSphere Project Context

BuildSphere is an AI-assisted Developer Experience Platform for designing, generating, deploying, observing, and improving microservice applications.

Current implementation status:

- Local-first MVP code is implemented through roadmap Phase 5.
- Authentication, projects, generation, pipelines, logs, suggestions, deployment targets, monitoring, notifications, and frontend workflows are present.
- Frozen dependency installation, lint, production builds, and automated tests pass.
- Memory and PostgreSQL gateway smoke workflows pass.
- Live migration, persistence after restart, and desktop/mobile browser verification are complete.
- Database-backed services use a shared idempotent graceful-shutdown helper.

Primary goal now:

Choose the first Phase 6 integration deliberately and document its requirements before implementation.

Default stack:

- React + Vite + TypeScript frontend.
- Node.js + TypeScript backend services.
- PostgreSQL for durable data.
- Redis for cache and future lightweight queues.
- Docker for local infrastructure.
- GitHub Actions for CI.
