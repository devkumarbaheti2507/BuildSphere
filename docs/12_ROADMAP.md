# Document Information

| Field | Value |
| --- | --- |
| Document | Roadmap |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
| Related Documents | 01_SRS.md, 13_BACKLOG.md |

---

# Purpose

This document defines the phased implementation roadmap for BuildSphere.

# Phase 0: Repository foundation

Status: Ready.

Goals:

- Create repository structure.
- Add documentation.
- Add Codex instructions.
- Add service skeletons.
- Add frontend skeleton.
- Add templates and prompts.

Exit criteria:

- Repository can be opened by Codex.
- Documentation explains what to build.
- Service folders exist.

# Phase 1: Core platform MVP

Status: Complete.

Goal: Build the minimum usable product.

Features:

1. Auth Service basic register/login.
2. API Gateway route forwarding.
3. Project Service create/list/view project.
4. Frontend auth pages and dashboard.
5. Create project wizard.
6. Tool selection model.
7. Template catalog model.

Exit criteria:

- User can sign up, log in, and create a project.
- Project data persists in PostgreSQL.
- Frontend displays created projects.

# Phase 2: Generation engine

Status: Complete.

Goal: Generate useful project and DevOps files.

Features:

1. Template resolver.
2. Node.js backend template.
3. React frontend template.
4. Dockerfile generation.
5. GitHub Actions workflow generation.
6. Kubernetes manifest generation.
7. Generated artifact archive.

Exit criteria:

- User can generate and download or inspect files for a selected stack.

# Phase 3: Pipeline model and logs

Status: Complete.

Goal: Show pipeline lifecycle.

Features:

1. Pipeline definition creation.
2. Pipeline stages.
3. Pipeline execution records.
4. Simulated execution runner.
5. Log storage.
6. Log viewer UI.
7. Stage explanations.

Exit criteria:

- User can trigger a simulated pipeline and view stage-by-stage logs.

# Phase 4: AI and recommendation engine

Status: Complete for local `rules` and `mock` modes. External provider calls remain future work.

Goal: Give meaningful suggestions.

Features:

1. Rule-based suggestion engine.
2. Prompt loading from `prompts/`.
3. Mock AI provider.
4. Optional external AI provider interface.
5. Suggestions UI.

Exit criteria:

- User receives actionable recommendations for generated assets.

# Phase 5: Deployment and observability foundations

Status: Complete.

Goal: Move toward real DevOps operations.

Features:

1. Kubernetes manifest validation.
2. Deployment target model.
3. Monitoring service health aggregation.
4. Prometheus metrics placeholder.
5. Notification service.

Exit criteria:

- User can define a deployment target and inspect deployment-ready assets.

# Phase 6: Advanced integrations

Future features:

- GitHub OAuth.
- GitHub repository creation.
- GitHub Actions run integration.
- Jenkins integration.
- Helm chart generation.
- Terraform generation.
- Real Kubernetes deployment.
- Cost estimation.
- Team collaboration.

# Recommended first implementation order for Codex

1. Confirm workspace builds.
2. Implement shared types package.
3. Implement Auth Service.
4. Implement Project Service.
5. Implement API Gateway routes.
6. Implement frontend auth and dashboard.
7. Implement project wizard.
8. Implement template catalog.
9. Implement generation engine.
