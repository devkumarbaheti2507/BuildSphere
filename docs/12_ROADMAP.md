# Document Information

| Field             | Value                    |
| ----------------- | ------------------------ |
| Document          | Roadmap                  |
| Version           | 0.1.0                    |
| Status            | Draft                    |
| Author            | BuildSphere Team         |
| Last Updated      | 2026-07-10               |
| Related Documents | 01_SRS.md, 13_BACKLOG.md |

---

# Purpose

This document defines the phased implementation roadmap for BuildSphere.

# Phase 0: Repository foundation

Status: Complete.

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

Status: Complete for the tracked GitHub integration milestone.

Phase 6 scope:

- GitHub OAuth. Complete.
- GitHub repository creation. Complete.
- GitHub Actions run integration. Complete.

Exit criteria:

- A connected user can publish generated files to a durable project repository link.
- BuildSphere can synchronize and display GitHub Actions workflow runs.
- Provider secrets remain server-side, expired user tokens rotate safely, and retry behavior is deterministic.

# Phase 7: Helm chart generation

Status: Complete.

Goal: Package generated Kubernetes workloads as a configurable, reusable Helm
chart without performing a real cluster deployment.

Features:

1. Optional Helm tool selection with a Kubernetes dependency.
2. Selection-aware template catalog resolution.
3. Helm chart metadata, values, helpers, workload, service, ingress, and notes.
4. Preserved Helm Go-template expressions in generated artifacts.
5. Raw Kubernetes validation isolated from Helm source templates.
6. Chart-aware generated CI checks and regression coverage.

Exit criteria:

- A Kubernetes project can opt into Helm and inspect, download, or publish a
  complete chart through existing artifact workflows.
- A project without Helm does not receive Helm files.
- Invalid Helm-without-Kubernetes selections fail with a structured error.
- Existing Phase 0-6 verification remains green.

# Phase 8: Terraform AWS EKS generation

Status: Complete as of 2026-07-10.

Goal: Generate safe, reviewable infrastructure-as-code for an AWS EKS target
without provisioning cloud resources.

Features:

1. Optional Terraform AWS EKS tool selection with a Kubernetes dependency.
2. Versioned Terraform, AWS provider, VPC module, and EKS module requirements.
3. Disabled-by-default VPC, EKS, managed-node, access, and output definitions.
4. Example local values, remote-backend guidance, state ignore rules, and
   operator documentation.
5. Generated CI format/init/validate checks without plan or apply.
6. Terraform CLI format and static validation plus cross-phase regression
   coverage.

Exit criteria:

- A Kubernetes project can opt into Terraform and inspect, download, or
  publish a complete AWS EKS root module.
- Unselected projects receive no `terraform/` files.
- Terraform without Kubernetes fails with a structured dependency error.
- Generated defaults create no cloud resources and contain no credentials.
- Generated Terraform passes format and static validation.
- Existing Phase 0-7 verification remains green.

Verification outcome:

- The default wizard bundle now contains 26 files, including all nine
  Terraform files, while projects without the selection receive no
  `terraform/` paths.
- A checksum-verified Terraform v1.15.8 binary passed format,
  backend-disabled initialization, exact module resolution, and static
  validation without credentials.
- Frozen install, lint, all builds, all 41 automated tests, the PostgreSQL
  gateway smoke, and the Phase 6 provider verifier pass.
- The 26-file Phase 8 artifact remained in PostgreSQL across application
  service restarts.
- No AWS or Kubernetes resource was created.

# Post-Phase 8 candidates

These items require separate specifications and backlog milestones:

- Jenkins integration.
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
