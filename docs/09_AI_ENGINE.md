# Document Information

| Field | Value |
| --- | --- |
| Document | AI Engine Design |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
| Related Documents | 00_PROJECT_VISION.md, specs/AI_SPEC.md, prompts/* |

---

# Purpose

This document defines the AI and recommendation behavior in BuildSphere.

# AI philosophy

BuildSphere AI should explain and suggest. It should not secretly modify user projects without approval.

# MVP strategy

The MVP uses two modes:

1. Rule-based suggestions.
2. Mock LLM provider or optional external LLM provider.

This keeps development possible without relying on paid APIs.

# Suggestion categories

- Architecture.
- Docker.
- Kubernetes.
- CI/CD.
- Security.
- Testing.
- Cost.
- Observability.

# Suggestion severity

```text
low
medium
high
critical
```

# Rule examples

## Docker image size risk

Condition:

- Dockerfile uses `node:latest` or no multi-stage build.

Suggestion:

- Use pinned image versions and multi-stage builds.

## Kubernetes health check missing

Condition:

- Generated deployment has no readiness probe.

Suggestion:

- Add readiness and liveness probes.

## Testing missing

Condition:

- No test command configured.

Suggestion:

- Add unit test command before build stage.

# Prompt storage

Prompts must live in `prompts/`.

The AI service should load prompt files and inject structured context.

# AI output schema

```json
{
  "suggestions": [
    {
      "category": "docker",
      "severity": "medium",
      "title": "Use a multi-stage Docker build",
      "description": "A multi-stage build can reduce image size and separate build dependencies from runtime dependencies.",
      "recommendedAction": "Use a builder stage and copy only production artifacts to the final image.",
      "confidence": 0.82
    }
  ]
}
```

# Safety rules

- Do not expose secrets to AI providers.
- Redact tokens, passwords, and private keys.
- Prefer sending metadata instead of full source code where possible.
- Store AI output as suggestions, not automatic changes.
