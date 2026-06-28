# BuildSphere

BuildSphere is an AI-assisted Developer Experience Platform that helps developers design, configure, build, deploy, monitor, and optimize modern microservice applications while explaining DevOps concepts in real time.

The project is intentionally documented before implementation so that human developers and AI coding agents can use the repository as a shared source of truth.

## What BuildSphere does

BuildSphere guides a user through the full software delivery lifecycle:

1. Create a project.
2. Select architecture, language, framework, database, CI/CD provider, container registry, and deployment target.
3. Generate starter project files, Dockerfiles, CI/CD workflows, Kubernetes manifests, and documentation.
4. Run or connect to pipeline executions.
5. Stream build and deployment logs.
6. Explain each pipeline stage in learning mode.
7. Provide AI-assisted suggestions for architecture, Docker, Kubernetes, security, testing, cost, and reliability.

## MVP scope

The first version focuses on a practical developer workflow:

- User authentication.
- Project creation wizard.
- Tool selection wizard.
- Template-based generation for Node.js, React, Docker, GitHub Actions, and Kubernetes.
- Pipeline definition storage.
- Live log model and mock log streaming.
- AI suggestion framework using prompt templates and rule-based checks.
- Documentation-first development workflow.

## Preferred technology stack

This repository is prepared for a TypeScript-first implementation:

| Layer | Default Choice | Reason |
| --- | --- | --- |
| Frontend | React + Vite + TypeScript | Fast UI development and strong ecosystem. |
| Backend services | Node.js + TypeScript + Express initially, NestJS-compatible structure later | Simple to start, easy for Codex to implement, microservice-friendly. |
| Database | PostgreSQL | Strong relational model, transactions, auditability. |
| Cache and queues | Redis initially, Kafka optional later | Redis keeps the MVP simple; Kafka can be added for event-heavy flows. |
| Containerization | Docker | Required for generated workloads and BuildSphere services. |
| Orchestration | Kubernetes | Primary target for production deployment templates. |
| CI/CD | GitHub Actions first | Common, accessible, and portfolio-friendly. |
| Monitoring | Prometheus + Grafana planned | Standard cloud-native observability stack. |

## Repository structure

```text
BuildSphere/
├── README.md
├── BUILDSPHERE_MANIFEST.md
├── AGENTS.md
├── docs/
├── specs/
├── research/
├── memory/
├── prompts/
├── templates/
├── frontend/
├── backend/
├── packages/
├── infrastructure/
├── scripts/
├── examples/
├── assets/
└── .github/
```

## Reading order before coding

Codex and human developers should read these files first:

1. `AGENTS.md`
2. `BUILDSPHERE_MANIFEST.md`
3. `docs/00_PROJECT_VISION.md`
4. `docs/01_SRS.md`
5. `docs/02_HLD.md`
6. `docs/03_LLD.md`
7. `docs/12_ROADMAP.md`
8. The relevant file inside `specs/`

## Quick start for local development

The initial repository contains documentation and service skeletons. After cloning:

```bash
corepack enable
pnpm install
pnpm -r build
```

Start infrastructure dependencies:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Start all services in development mode:

```bash
pnpm -r --parallel dev
```

## Development approach

BuildSphere follows a documentation-first workflow:

```text
Requirement -> Design -> Spec -> Implementation -> Test -> Documentation update
```

A feature is not considered complete until its code, tests, docs, and memory files are updated.

## Current status

Status: Planning and starter scaffold.

The repository is ready for Codex-assisted implementation. Start with milestone M1 in `docs/12_ROADMAP.md` and the tickets in `docs/13_BACKLOG.md`.

## License

MIT License. See `LICENSE`.
