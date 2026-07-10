# Document Information

| Field             | Value                         |
| ----------------- | ----------------------------- |
| Document          | Security Design               |
| Version           | 0.1.0                         |
| Status            | Draft                         |
| Author            | BuildSphere Team              |
| Last Updated      | 2026-07-10                    |
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

Phase 6:

- GitHub App OAuth with signed, expiring state.
- PKCE using `S256`.
- Verified GitHub email required for account creation or linking.
- GitHub user and refresh tokens encrypted with AES-256-GCM before storage.
- GitHub client secrets and token-encryption keys loaded only from environment variables.
- Expired GitHub user tokens refreshed server-side with replacement access and refresh tokens encrypted atomically.
- Repository publishing and Actions synchronization exposed publicly only through owner-checked Project Service routes.
- Internal provider operations protected by `INTERNAL_SERVICE_TOKEN`; plaintext provider tokens remain inside Auth Service.

Future:

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
- Generated Helm charts must not contain credentials or Kubernetes Secret
  values; operators provide sensitive values through an external secret
  workflow.

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

| Threat                                 | Control                                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Stolen password                        | Hash passwords, enforce minimum length.                                                                              |
| Unauthorized project access            | Owner checks on project APIs.                                                                                        |
| Secret leakage in generated files      | Use placeholders and warnings.                                                                                       |
| Prompt injection through project files | Treat input as untrusted data.                                                                                       |
| Broken deployment config               | Validate generated YAML before use.                                                                                  |
| OAuth callback forgery                 | Signed expiring state and PKCE verifier binding.                                                                     |
| Provider token disclosure              | AES-GCM encryption at rest and no frontend token exposure.                                                           |
| Account-link takeover                  | Link only from a verified GitHub email or an existing stable GitHub user ID.                                         |
| Cross-project repository publishing    | Project Service verifies ownership before invoking internal provider operations.                                     |
| Generated path traversal               | Reject absolute, empty, duplicate, and parent-traversal file paths before GitHub writes.                             |
| Partial repository publish             | Persist the repository link immediately and make later publishes idempotent file updates.                            |
| Stale provider credentials             | Refresh before expiry and require reauthorization when the refresh token is absent or expired.                       |
| Helm source treated as deployed YAML   | Validate only rendered raw Kubernetes manifests; Helm expressions remain source until an operator renders the chart. |

# Audit logs

Future versions should record:

- Login events.
- Project creation.
- Pipeline generation.
- Deployment actions.
- Provider connection changes.
