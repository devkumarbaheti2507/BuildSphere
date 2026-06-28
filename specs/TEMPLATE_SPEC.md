# Document Information

| Field | Value |
| --- | --- |
| Document | Template Spec |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
| Related Documents | ../templates/* |

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

# MVP templates

- React app README.
- Node service Dockerfile.
- GitHub Actions Node pipeline.
- Kubernetes deployment/service/ingress.

# Acceptance criteria

- Template catalog lists available templates.
- Generator resolves selected templates.
- Generated content uses provided variables.
