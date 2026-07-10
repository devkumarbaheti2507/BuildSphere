# Document Information

| Field             | Value            |
| ----------------- | ---------------- |
| Document          | Template Spec    |
| Version           | 0.1.0            |
| Status            | Draft            |
| Author            | BuildSphere Team |
| Last Updated      | 2026-07-10       |
| Related Documents | ../templates/*   |

---

# Purpose

Define how BuildSphere stores, selects, and renders templates.

# Template categories

- frontend
- backend
- docker
- github-actions
- jenkins
- kubernetes
- terraform
- helm

# Template metadata

Each template should have:

- key
- category
- displayName
- description
- supportedVariables
- outputPath

# Rendering rules

- Use placeholders like `{{projectName}}`.
- Missing required variables should fail validation.
- Generated files should be previewable before download.
- Resolve only templates associated with saved project tool selections.
- Preserve Helm expressions such as `{{ .Values.image.repository }}` while
  replacing BuildSphere placeholders whose keys use the documented variable
  names.

# MVP templates

- React app README.
- Node service Dockerfile.
- GitHub Actions Node pipeline.
- Kubernetes deployment/service/ingress.

# Phase 7 templates

- Helm Chart metadata and default values.
- Reusable helpers.
- Deployment, Service, and optional Ingress templates.
- Installation notes.

# Acceptance criteria

- Template catalog lists available templates.
- Generator resolves selected templates.
- Generated content uses provided variables.
- Unselected template categories do not appear in an artifact.
