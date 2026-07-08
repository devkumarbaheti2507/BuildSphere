# BuildSphere Project Context

BuildSphere is an AI-assisted Developer Experience Platform for designing, generating, deploying, observing, and improving microservice applications.

Current implementation status:

- Local-first MVP code is implemented through roadmap Phase 5.
- Authentication, projects, generation, pipelines, logs, suggestions, deployment targets, monitoring, notifications, and frontend workflows are present.
- Workspace builds and focused in-memory API tests pass.
- Fresh dependency installation, live PostgreSQL migration, and browser E2E verification remain release blockers because external registry and browser access were unavailable.

Primary goal now:

Complete BS-901 and BS-902 release verification, then choose the first Phase 6 integration deliberately.

Default stack:

- React + Vite + TypeScript frontend.
- Node.js + TypeScript backend services.
- PostgreSQL for durable data.
- Redis for cache and future lightweight queues.
- Docker for local infrastructure.
- GitHub Actions for CI.
