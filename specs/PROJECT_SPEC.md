# Document Information

| Field | Value |
| --- | --- |
| Document | Project Spec |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
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

# MVP supported tools

```json
{
  "frontend": ["react"],
  "backend": ["nodejs"],
  "database": ["postgresql"],
  "cache": ["redis"],
  "ci": ["github-actions"],
  "container": ["docker"],
  "deployment": ["kubernetes"]
}
```

# Business rules

- Project names must be unique per owner.
- Archived projects cannot generate new artifacts.
- Tool selections must use supported tool keys.

# Acceptance criteria

- Create project persists data.
- List projects returns only owner projects.
- Tool selection saves config.
- Generate request uses saved selections.
