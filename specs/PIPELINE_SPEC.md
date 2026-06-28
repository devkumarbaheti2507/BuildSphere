# Document Information

| Field | Value |
| --- | --- |
| Document | Pipeline Spec |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
| Related Documents | ../docs/03_LLD.md, LOGGING_SPEC.md |

---

# Purpose

Define pipeline definitions, stages, and executions.

# Pipeline definition

Fields:

- id
- projectId
- name
- provider
- stages
- createdAt

# Default MVP stages

```text
checkout
install_dependencies
run_tests
build_application
build_docker_image
push_artifact
validate_kubernetes_manifests
```

# Execution statuses

```text
queued
running
succeeded
failed
cancelled
```

# Stage statuses

```text
pending
running
succeeded
failed
skipped
```

# Business rules

- A pipeline belongs to one project.
- An execution belongs to one pipeline.
- Status transitions must follow LLD rules.
- Logs must be retrievable by execution ID.

# MVP runner

The MVP may simulate pipeline execution with timed stage updates and generated logs.

# Acceptance criteria

- Create pipeline definition from project tools.
- Start simulated execution.
- View execution status.
- View logs by execution.
