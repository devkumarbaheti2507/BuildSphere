# Document Information

| Field             | Value                               |
| ----------------- | ----------------------------------- |
| Document          | Project Spec                        |
| Version           | 0.1.0                               |
| Status            | Draft                               |
| Author            | BuildSphere Team                    |
| Last Updated      | 2026-07-10                          |
| Related Documents | ../docs/01_SRS.md, TEMPLATE_SPEC.md |

---

# Purpose

Define project management and tool selection behavior.

# Project creation inputs

- name
- description
- architectureType
- visibility

# Tool selection categories

- frontend
- backend
- database
- cache
- ci
- container
- deployment
- monitoring
- packaging
- infrastructure

# MVP supported tools

```json
{
  "frontend": ["react"],
  "backend": ["nodejs"],
  "database": ["postgresql"],
  "cache": ["redis"],
  "ci": ["github-actions"],
  "container": ["docker"],
  "deployment": ["kubernetes"],
  "monitoring": ["prometheus"],
  "packaging": ["helm"],
  "infrastructure": ["terraform-aws-eks"]
}
```

# Business rules

- Project names must be unique per owner.
- Archived projects cannot generate new artifacts.
- Tool selections must use supported tool keys.
- Helm requires the Kubernetes deployment selection.
- Terraform AWS EKS requires the Kubernetes deployment selection.
- Generated artifacts include only templates implied by saved tool selections.

# Acceptance criteria

- Create project persists data.
- List projects returns only owner projects.
- Tool selection saves config.
- Generate request uses saved selections.
