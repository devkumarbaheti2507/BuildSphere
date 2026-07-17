# Document Information

| Field             | Value                      |
| ----------------- | -------------------------- |
| Document          | Implementation Specs Index |
| Version           | 0.1.0                      |
| Status            | Draft                      |
| Author            | BuildSphere Team           |
| Last Updated      | 2026-07-15                 |
| Related Documents | ../docs/03_LLD.md          |

---

# Purpose

Specs are implementation-focused instructions for Codex and developers.

# Spec files

| File                               | Purpose                                                                |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `AUTH_SPEC.md`                     | Auth implementation.                                                   |
| `USER_SPEC.md`                     | User model and profile behavior.                                       |
| `PROJECT_SPEC.md`                  | Project and tool selection behavior.                                   |
| `PIPELINE_SPEC.md`                 | Pipeline model, stages, and execution behavior.                        |
| `DEPLOYMENT_SPEC.md`               | Deployment targets and generated manifests.                            |
| `AI_SPEC.md`                       | Suggestions and prompt behavior.                                       |
| `NOTIFICATION_SPEC.md`             | Notification behavior.                                                 |
| `LOGGING_SPEC.md`                  | Pipeline logs and service logging.                                     |
| `TEMPLATE_SPEC.md`                 | Template catalog and generation engine.                                |
| `GITHUB_INTEGRATION_SPEC.md`       | GitHub App OAuth and later GitHub provider workflows.                  |
| `HELM_SPEC.md`                     | Optional Helm packaging and chart generation behavior.                 |
| `TERRAFORM_SPEC.md`                | Safe AWS EKS Terraform generation behavior.                            |
| `PRODUCTION_DEPLOYMENT_SPEC.md`    | BuildSphere container and Helm deployment packaging.                   |
| `PRODUCTION_OBSERVABILITY_SPEC.md` | BuildSphere metrics, SLO, alert, and dashboard contract.               |
| `RUNTIME_RELIABILITY_SPEC.md`      | BuildSphere rollout, scaling, disruption, and network policy contract. |
| `SUPPLY_CHAIN_SECURITY_SPEC.md`    | BuildSphere image, SBOM, signing, provenance, and release evidence contract. |
| `PERSONAL_FREE_TIER_DEPLOYMENT_SPEC.md` | BuildSphere single-node AMD64/ARM64 personal deployment prerequisite contract. |
