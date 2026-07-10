# BuildSphere Presentation and Learning Guide

## Purpose

This guide turns the technical knowledge graph into a practical way to:

- understand the project from beginner to interview depth;
- present it as a portfolio, academic, or engineering project;
- run a focused product demonstration;
- answer architecture and technology questions honestly;
- use ChatGPT as a tutor, interviewer, and presentation coach.

Read `docs/15_PROJECT_KNOWLEDGE_GRAPH.md` first when detailed project facts are
needed.

## The story to tell

BuildSphere begins with a simple problem: developers can understand Docker,
CI/CD, Kubernetes, and monitoring individually but still struggle to connect
them into a coherent delivery workflow. BuildSphere turns those disconnected
tools into one guided and explainable experience.

The project is valuable in three ways:

1. **Product value**: users configure a stack and receive reusable delivery assets.
2. **Learning value**: every pipeline stage and generated file explains why it exists.
3. **Engineering value**: the implementation demonstrates service boundaries, security, persistence, testing, and a real provider integration.

## Elevator pitches

### 30 seconds

> BuildSphere is a local-first Developer Experience Platform built with React,
> TypeScript microservices, and PostgreSQL. It guides a user through project and
> stack selection, generates Docker, GitHub Actions, and Kubernetes assets,
> simulates an explainable delivery pipeline, recommends improvements, validates
> manifests, and can publish the result to GitHub and synchronize real Actions
> runs.

### Two minutes

> Modern application delivery requires many tools, but the hard part is often
> understanding how they fit together. BuildSphere gives learners and portfolio
> builders one guided workspace. The user creates a project, chooses a stack,
> generates ten DevOps and configuration files, previews or downloads them,
> follows a seven-stage pipeline with learning notes and logs, receives
> deterministic architecture and DevOps suggestions, and validates Kubernetes
> manifests.
>
> The system is a PNPM TypeScript monorepo. A React and Vite frontend calls an
> Express API Gateway, which routes to focused services for authentication,
> projects, pipelines, logs, recommendations, deployment, monitoring, and
> notifications. PostgreSQL stores durable state. Shared packages provide
> domain contracts and backend mechanics such as JWT verification, scrypt
> password hashing, structured errors, correlation IDs, migrations, and
> graceful shutdown.
>
> Phase 6 adds a real GitHub App integration. OAuth uses signed state and PKCE;
> provider tokens are encrypted with AES-256-GCM. Project Service verifies
> ownership while Auth Service keeps the provider secret boundary. Generated
> files can be published idempotently to a private repository, and GitHub
> Actions runs are synchronized back into BuildSphere. Real cloud deployment is
> intentionally future work: the MVP generates, explains, and validates before
> it changes external infrastructure.

## Recommended slide deck

### Slide 1: BuildSphere

- Subtitle: AI-assisted Developer Experience Platform.
- One sentence: guided generation, explanation, validation, and integration.
- Visual: the running dashboard or project workspace.

### Slide 2: Problem

- Delivery tools are individually understandable but difficult to connect.
- Repetitive setup consumes time.
- Beginners need explanation; experienced developers need reusable standards.

### Slide 3: Users and value

- Learning developer.
- DevOps/backend portfolio builder.
- Future small-team developer.
- Value: one workflow from choices to inspectable delivery assets.

### Slide 4: User journey

Show this sequence:

```text
Authenticate -> Create project -> Choose tools -> Generate assets
-> Inspect/download -> Run explainable pipeline -> Review suggestions
-> Validate deployment -> Publish to GitHub -> Synchronize Actions
```

### Slide 5: Architecture

- React frontend and API Gateway.
- Focused TypeScript services.
- Shared contracts and service core.
- PostgreSQL for durable state.
- GitHub as the connected external provider.

Use the system graph from `docs/15_PROJECT_KNOWLEDGE_GRAPH.md`.

### Slide 6: Generation engine

- Template catalog plus typed generation variables.
- Ten current outputs.
- SHA-256 bundle checksum.
- Preview, explanation, TAR download, and GitHub publishing.
- Be explicit that it generates DevOps/config scaffolding, not full app source.

### Slide 7: Explainable delivery

- Seven modeled stages.
- Success, failure injection, cancellation, and logs.
- Learning notes include purpose, failures, and fixes.
- Internal runner is simulated; GitHub Actions is the connected real CI path.

### Slide 8: AI-assisted design

- Thirteen deterministic checks.
- Rules and mock modes work without external services.
- Prompt library prepares a future external provider.
- Suggestions require user acceptance; they do not silently change files.

### Slide 9: Security

- scrypt passwords.
- HS256 access/refresh JWTs.
- Hashed refresh tokens.
- Signed OAuth state plus PKCE S256.
- AES-256-GCM provider tokens.
- Owner checks and internal service tokens.
- Safe path validation and placeholder secrets.

### Slide 10: GitHub integration

- GitHub App login.
- Durable one-repository-per-project link.
- Serial, idempotent file publication.
- Workflow files published last.
- Latest 50 Actions runs normalized and upserted.
- Live OAuth, private repository creation, ten-file publish, successful Actions sync, and no-op republish were verified.

### Slide 11: Quality evidence

- Frozen lockfile install.
- ESLint and all production builds.
- 41 automated tests.
- Memory and PostgreSQL gateway smoke workflows.
- Migration idempotency and restart persistence.
- Desktop/mobile browser checks.
- Real GitHub integration validation.
- Strict Helm v4.2.2 lint, rendered manifests, and PostgreSQL restart
  persistence for the 17-file artifact.

### Slide 12: Boundaries and roadmap

- Selection-aware generation and optional Helm packaging are implemented.
- No real cluster apply or cloud deployment.
- No external LLM yet.
- Redis/MinIO/MailHog prepared but not active.
- Next candidates: Jenkins, Terraform, real Kubernetes, cost, collaboration.
- Explain that these are intentional roadmap boundaries, not hidden claims.

## Ten-minute live demonstration

### Preparation

1. Start PostgreSQL and local dependencies:

   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

2. Apply migrations:

   ```bash
   pnpm db:migrate
   ```

3. Start the workspace:

   ```bash
   pnpm -r --parallel dev
   ```

4. Open `http://localhost:5173` and keep one prepared project available as a fallback.
5. Confirm GitHub configuration before promising the GitHub portion of the demo.
6. Never show `.env`, provider secrets, access tokens, or database token columns on screen.

### Demo sequence

|       Time | Action                  | What to explain                                                    |
| ---------: | ----------------------- | ------------------------------------------------------------------ |
|  0:00-1:00 | Login and dashboard     | Two auth paths, projects, health, notifications                    |
|  1:00-2:30 | Create a project        | Architecture and tool choices become typed project configuration   |
|  2:30-4:00 | Generate assets         | Template variables, ten files, explanations, checksum, download    |
|  4:00-5:30 | Run pipeline            | Seven stages, learning notes, simulated state and log flow         |
|  5:30-6:30 | Show suggestions        | Deterministic checks, severity, confidence, accept/dismiss         |
|  6:30-7:30 | Validate deployment     | Kubernetes structural checks and environment target model          |
|  7:30-9:00 | GitHub tab              | Durable repository link, safe publication, Actions synchronization |
| 9:00-10:00 | Close with architecture | Service boundaries, security, tests, honest future work            |

### Optional failure demonstration

Use **Simulate failure** in the Pipeline tab. It fails at `run_tests`, writes an
error log, stops later stages, and creates a failure notification. Explain that
failure injection demonstrates state transitions and user feedback without
requiring a real build runner.

## How to explain the stack simply

| Technology      | Beginner explanation                     | Interview-level explanation                                                 |
| --------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| React           | Builds the interactive screens           | Component-based UI with local state and a typed API client                  |
| Vite            | Runs and bundles the frontend quickly    | Fast ESM development server and optimized production build                  |
| TypeScript      | Adds types to JavaScript                 | Shares compile-time domain contracts across browser and services            |
| Node.js         | Runs TypeScript/JavaScript on the server | Async I/O runtime well suited to REST and provider calls                    |
| Express         | Maps URLs to backend behavior            | Minimal middleware/routing layer that keeps domain ownership explicit       |
| Zod             | Checks incoming request data             | Runtime schema validation at trust boundaries                               |
| PostgreSQL      | Stores durable structured data           | Relational integrity, transactions, indexes, JSONB, and explicit migrations |
| PNPM workspaces | Manages all packages together            | Efficient monorepo linking with a single reproducible lockfile              |
| Docker          | Packages software and local dependencies | Reproducible images plus Compose-based local infrastructure                 |
| Kubernetes      | Describes how containers run together    | Declarative workload, networking, probes, resources, and ingress model      |
| GitHub Actions  | Runs automated workflow jobs             | Real connected CI provider whose runs are normalized into BuildSphere       |
| Pino            | Writes machine-readable logs             | Structured logging with request correlation and latency metadata            |
| JWT             | Carries authenticated identity           | Signed stateless claims verified independently by each service              |
| AES-GCM         | Encrypts GitHub tokens                   | Authenticated encryption protects confidentiality and integrity at rest     |

## Architecture questions and answers

### Why use microservices for an MVP?

BuildSphere is both a product and a platform-engineering learning project. The
service boundaries demonstrate ownership and integration. The tradeoff is more
local processes and operational complexity than a modular monolith would need.
The monorepo and shared packages reduce that development overhead.

### Why use a monorepo if the backend is microservice-oriented?

Independent deployability and source-repository layout are separate decisions.
The monorepo keeps contracts, documentation, templates, and changes coordinated
while services still expose independent ports, APIs, repositories, and builds.

### Why use raw SQL instead of an ORM?

The schema and service ownership remain visible, migrations are reviewable, and
`pg` is the only database abstraction. The tradeoff is more mapping code and a
need for SQL discipline.

### Why does Project Service call Auth Service for GitHub?

Project Service owns project authorization and artifact selection. Auth Service
owns encrypted provider tokens. The internal-token boundary prevents GitHub
tokens from spreading into Project Service while avoiding duplicated project
ownership logic in Auth Service.

### Why are GitHub files written serially?

Concurrent GitHub Contents API writes can conflict on branch updates. Serial
writes are simpler and deterministic for an MVP. Unchanged Git blobs are
skipped, repository links survive partial failures, and workflows are written
last to avoid running against incomplete content.

### Why simulate the internal pipeline?

The MVP teaches state, logs, stages, failure, and cancellation without building
a distributed runner. Real GitHub Actions synchronization proves the provider
integration path, while a full custom runner remains intentionally out of
scope.

### Why call the product AI-assisted when the default is rules?

The architecture supports a `SuggestionAnalyzer` interface and prompt files,
but the useful core must work offline and without paid APIs. Deterministic rules
are explainable and testable. An external model is an enhancement, not a hidden
dependency.

### How is data isolated between users?

Services verify the signed access JWT and use its user ID in owner-scoped
queries. Project Service checks project ownership before artifact or GitHub
operations. Logs, suggestions, targets, and notifications also include owner or
user scope.

### What happens when a supporting service fails during generation?

The generated artifact remains durable. Pipeline creation and initial AI
analysis run as best-effort parallel coordination and are logged when skipped.
This prevents an optional downstream failure from destroying the user's core
output.

## Honest answers about limitations

Use direct language:

- "The current bundle generates delivery/configuration scaffolding, not complete application source code."
- "The internal pipeline is simulated; GitHub Actions is the real connected CI provider."
- "Kubernetes files are generated and structurally validated, but BuildSphere does not apply them to a cluster."
- "The AI interface and prompts are ready for a provider, but current recommendations use deterministic rules or mock data."
- "Redis, MinIO, and MailHog are local infrastructure preparation, not active service dependencies today."
- "The Analytics Service currently proves the service contract through health only."

These statements improve credibility because they show deliberate scope control.

## Learning curriculum

### Module 1: Product and scope

Read:

- `README.md`
- `BUILDSPHERE_MANIFEST.md`
- `docs/00_PROJECT_VISION.md`
- `docs/12_ROADMAP.md`

Be able to explain the user, problem, MVP boundary, and current phase.

### Module 2: Monorepo and TypeScript contracts

Read:

- `package.json`
- `pnpm-workspace.yaml`
- `packages/shared-types/src/index.ts`
- `tsconfig.base.json`

Be able to trace one type, such as `GeneratedArtifact`, from backend to frontend.

### Module 3: Frontend workflow

Read:

- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `frontend/src/pages/CreateProjectPage.tsx`
- `frontend/src/pages/ProjectPage.tsx`

Be able to demonstrate route selection, session storage, API calls, and tabs.

### Module 4: REST services and shared mechanics

Read:

- `backend/api-gateway/src/app.ts`
- `packages/service-core/src/http.ts`
- `packages/service-core/src/errors.ts`
- `packages/service-core/src/auth.ts`

Be able to explain routing, correlation IDs, error envelopes, and JWT checks.

### Module 5: PostgreSQL and repositories

Read:

- `infrastructure/database/migrations/`
- `packages/service-core/src/database.ts`
- one Postgres repository and its in-memory counterpart

Be able to draw the entity relationships and explain logical service ownership.

### Module 6: Generation engine

Read:

- `backend/project-service/src/project-service.ts`
- `backend/project-service/src/template-catalog.ts`
- `templates/`

Be able to explain variables, rendering, output paths, checksum, TAR, and current fixed-catalog limitation.

### Module 7: Pipelines, logs, and notifications

Read:

- `backend/pipeline-service/src/stages.ts`
- `backend/pipeline-service/src/pipeline-service.ts`
- `backend/logging-service/`
- `backend/notification-service/`

Be able to narrate success, failure, and cancellation state transitions.

### Module 8: Recommendations and deployment foundations

Read:

- `backend/ai-service/src/rules.ts`
- `prompts/`
- `backend/deployment-service/src/validator.ts`
- `backend/monitoring-service/src/health-checker.ts`

Be able to distinguish deterministic analysis, structural validation, and real external execution.

### Module 9: GitHub and security

Read:

- `docs/adr/ADR-007-GitHub-App-OAuth.md`
- `docs/adr/ADR-008-GitHub-Integration-Boundary.md`
- `backend/auth-service/src/github-oauth.ts`
- `backend/auth-service/src/github-integration.ts`

Be able to explain PKCE, signed state, AES-GCM, token refresh, service boundary, idempotency, and Actions upserts.

### Module 10: Verification and engineering judgment

Read:

- `docs/11_TESTING.md`
- test files in each service
- `scripts/verify-workspace.sh`
- `scripts/smoke-mvp.ts`
- `scripts/verify-phase6-postgres.ts`

Be able to distinguish unit, API, smoke, persistence, browser, and live-provider evidence.

## ChatGPT study prompts

### Guided tutor

```text
Use the attached BuildSphere knowledge graph as the source of truth. Teach me
Module 1 from the presentation guide. Explain one concept at a time, connect it
to exact source files, and quiz me before continuing. Clearly label implemented,
prepared, and future features.
```

### Architecture viva

```text
Act as a senior software architect conducting a BuildSphere viva. Ask one
question at a time about service boundaries, PostgreSQL ownership, REST tradeoffs,
generation, pipelines, and GitHub security. Wait for my answer, score it out of
10, correct it, and provide a stronger interview answer.
```

### Source-code tour

```text
Teach me how a Generate assets click travels through BuildSphere. Trace frontend
state, API client, gateway routing, Project Service validation, template rendering,
PostgreSQL persistence, pipeline coordination, AI analysis, notifications, and
the returned UI state. Cite project file paths for every step.
```

### Security review

```text
Run a threat-model interview for BuildSphere. Focus on password storage, JWTs,
refresh-token revocation, OAuth state, PKCE, provider-token encryption, internal
service authentication, owner checks, path traversal, and secret handling. Do
not introduce facts not present in the knowledge graph.
```

### Presentation rehearsal

```text
I will present BuildSphere in 10 minutes. Act as my presentation coach. Ask me
to deliver each slide in order, identify unclear or exaggerated claims, and
rewrite my explanation in natural language while preserving the project's real
implementation boundaries.
```

### Mock interviewer

```text
Interview me for a backend/platform engineering role using BuildSphere as my
portfolio project. Mix product, TypeScript, REST, PostgreSQL, Docker, Kubernetes,
CI/CD, observability, security, testing, and tradeoff questions. Ask for concrete
examples from BuildSphere and challenge weak answers.
```

### Quiz generator

```text
Create a 30-question BuildSphere quiz from the attached graph: 10 beginner,
10 intermediate, and 10 advanced. Do not show answers until I respond. Include
scenario questions about failures, security boundaries, and future design.
```

## Final presentation checklist

- State the user problem before listing technologies.
- Explain one end-to-end workflow, not only folder names.
- Show how each technology solves a specific BuildSphere need.
- Distinguish simulated pipeline execution from real GitHub Actions.
- Distinguish generated scaffolding from complete application source.
- Mention security controls with their purpose, not as a vocabulary list.
- Show quality evidence: 41 tests, builds, smoke workflows, persistence,
  browser checks, live GitHub validation, and a 17-file Helm-enabled generation
  run.
- Name at least two tradeoffs and two future milestones.
- Keep secrets and `.env` off screen.
- End with what you learned and the next bounded improvement.
