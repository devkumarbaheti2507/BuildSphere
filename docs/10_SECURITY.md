# Document Information

| Field | Value |
| --- | --- |
| Document | Security Design |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
| Related Documents | 01_SRS.md, specs/AUTH_SPEC.md |

---

# Purpose

This document defines BuildSphere security expectations.

# Security goals

- Protect user accounts.
- Protect project configurations.
- Avoid secret leakage.
- Make generated templates reasonably safe by default.
- Keep AI inputs free of secrets.

# Authentication

MVP:

- Email and password authentication.
- Passwords stored using a strong one-way hash.
- JWT access tokens.
- Refresh tokens.

Future:

- GitHub OAuth.
- Organization SSO.
- Fine-grained RBAC.

# Authorization

Users can access only their own projects unless sharing features are implemented.

Basic roles:

- `user`
- `admin`

# Secrets

Rules:

- Never commit secrets.
- Do not store plaintext API keys.
- Use `.env.example` for examples only.
- Generated files must use placeholders.

# API security

- Validate request bodies.
- Return structured errors.
- Avoid leaking stack traces.
- Use rate limiting in future.
- Use CORS restrictions in deployed environments.

# AI security

Before sending data to an AI provider:

- Remove secrets.
- Remove private keys.
- Remove tokens.
- Remove passwords.
- Prefer metadata summaries.

# Threat model highlights

| Threat | Control |
| --- | --- |
| Stolen password | Hash passwords, enforce minimum length. |
| Unauthorized project access | Owner checks on project APIs. |
| Secret leakage in generated files | Use placeholders and warnings. |
| Prompt injection through project files | Treat input as untrusted data. |
| Broken deployment config | Validate generated YAML before use. |

# Audit logs

Future versions should record:

- Login events.
- Project creation.
- Pipeline generation.
- Deployment actions.
- Provider connection changes.
