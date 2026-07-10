# BuildSphere

BuildSphere is an AI-assisted Developer Experience Platform that helps developers design, configure, build, deploy, monitor, and optimize modern microservice applications while explaining DevOps concepts in real time.

The project uses documentation-first development so that human developers and AI coding agents can use the repository as a shared source of truth.

## What BuildSphere does

BuildSphere guides a user through the full software delivery lifecycle:

1. Create a project.
2. Select architecture, language, framework, database, CI/CD provider, container registry, and deployment target.
3. Generate starter project files, Dockerfiles, CI/CD workflows, Kubernetes
   manifests, optional Helm charts, disabled AWS EKS Terraform source, and
   documentation.
4. Run or connect to pipeline executions.
5. Stream build and deployment logs.
6. Explain each pipeline stage in learning mode.
7. Provide AI-assisted suggestions for architecture, Docker, Kubernetes, security, testing, cost, and reliability.

## MVP scope

The first version focuses on a practical developer workflow:

- User authentication.
- Project creation wizard.
- Tool selection wizard.
- Selection-aware template generation for Node.js, React, Docker, GitHub
  Actions, Kubernetes, optional Helm charts, and optional AWS EKS Terraform.
- Pipeline definition storage.
- Live log model and mock log streaming.
- AI suggestion framework using prompt templates and rule-based checks.
- Documentation-first development workflow.

## Preferred technology stack

This repository is prepared for a TypeScript-first implementation:

| Layer            | Default Choice                                                              | Reason                                                                |
| ---------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Frontend         | React + Vite + TypeScript                                                   | Fast UI development and strong ecosystem.                             |
| Backend services | Node.js + TypeScript + Express initially, NestJS-compatible structure later | Simple to start, easy for Codex to implement, microservice-friendly.  |
| Database         | PostgreSQL                                                                  | Strong relational model, transactions, auditability.                  |
| Cache and queues | Redis initially, Kafka optional later                                       | Redis keeps the MVP simple; Kafka can be added for event-heavy flows. |
| Containerization | Docker                                                                      | Required for generated workloads and BuildSphere services.            |
| Orchestration    | Kubernetes                                                                  | Primary target for production deployment templates.                   |
| Packaging        | Helm                                                                        | Configurable Kubernetes application charts without automatic install. |
| Infrastructure   | Terraform for AWS EKS                                                       | Reviewable infrastructure source with cloud creation disabled.        |
| CI/CD            | GitHub Actions first                                                        | Common, accessible, and portfolio-friendly.                           |
| Monitoring       | Prometheus + Grafana planned                                                | Standard cloud-native observability stack.                            |

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

Use Node.js 22, then install the workspace dependencies:

```bash
corepack enable
pnpm install
```

Create local configuration, start infrastructure, and apply the SQL migration:

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
pnpm db:migrate
```

Start all backend services and the frontend:

```bash
pnpm -r --parallel dev
```

Open `http://localhost:5173`. The API Gateway listens on `http://localhost:8080/api`.

GitHub integration is optional. To enable it, create a GitHub App with Email
read, Administration/Contents/Workflows write, and Actions read permissions;
install it for the repositories BuildSphere will manage; and register
`http://localhost:5173/auth/github/callback` as its callback URL, and fill in
the `GITHUB_*` values documented in `.env.example`. Generate the token
encryption key with `openssl rand -base64 32`.

Verify the complete workspace:

```bash
./scripts/verify-workspace.sh
```

When Terraform is installed, render and statically validate the generated AWS
EKS module without initializing a backend or contacting AWS:

```bash
pnpm verify:terraform
```

After PostgreSQL migrations are applied, verify the Phase 6 provider
persistence layer without making external GitHub changes:

```bash
pnpm smoke:phase6:postgres
```

For a non-durable smoke run without PostgreSQL, set `STORAGE_DRIVER=memory` in the environment together with local JWT and internal service tokens, start the workspace, then run:

```bash
npm run smoke
```

The smoke script exercises the complete API workflow through the gateway. Memory mode is for development verification only; data is lost when services restart.

## Development approach

BuildSphere follows a documentation-first workflow:

```text
Requirement -> Design -> Spec -> Implementation -> Test -> Documentation update
```

A feature is not considered complete until its code, tests, docs, and memory files are updated.

## Learn and present BuildSphere

Use these files as a safe, self-contained learning and presentation pack:

- `docs/15_PROJECT_KNOWLEDGE_GRAPH.md` explains the product, architecture, stack, workflows, data, security, testing, limitations, and evidence.
- `docs/project-knowledge-graph.json` provides structured nodes and relationships for AI tools.
- `docs/16_PRESENTATION_AND_LEARNING_GUIDE.md` provides slide notes, a live-demo script, interview answers, a study curriculum, and ChatGPT prompts.

The pack excludes `.env`, credentials, provider tokens, personal account data, and private repository identifiers.

## Current status

Status: Local-first platform implemented through roadmap Phase 8. GitHub App
authentication, generated repository publishing, Actions synchronization, and
optional Helm and AWS EKS Terraform generation are complete.

Implemented workflows include local and GitHub authentication, project and
tool configuration, selection-aware DevOps, Helm, and Terraform generation, GitHub
repository publishing, simulated pipelines, synchronized GitHub Actions runs,
rule-based suggestions, deployment target definitions, Kubernetes manifest
checks, health aggregation, and notifications. Generated Terraform defaults to
no cloud resources and is statically validated without credentials. Real Helm
installation, Terraform plan/apply, cloud deployment, and additional provider
integrations remain future work.

## License

MIT License. See `LICENSE`.
