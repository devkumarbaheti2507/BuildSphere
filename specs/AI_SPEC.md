# Document Information

| Field | Value |
| --- | --- |
| Document | AI Spec |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
| Related Documents | ../docs/09_AI_ENGINE.md, ../prompts/* |

---

# Purpose

Define AI and rule-based suggestion behavior.

# MVP modes

- `mock`: returns fixed sample suggestions.
- `rules`: analyzes project configuration and generated files.
- `external`: future provider interface.

# Suggestion object

Fields:

- id
- projectId
- category
- severity
- title
- description
- recommendedAction
- confidence
- status

# Required categories

- architecture
- docker
- kubernetes
- security
- testing
- cicd

# Prompt loading

Prompt files must be read from `prompts/`.

# Redaction

Before external AI calls, redact:

- passwords
- tokens
- API keys
- private keys
- connection strings

# Acceptance criteria

- Rule engine returns suggestions for known issues.
- Suggestions are stored and listed by project.
- User can dismiss a suggestion.
