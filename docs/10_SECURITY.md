# Document Information

| Field             | Value                         |
| ----------------- | ----------------------------- |
| Document          | Security Design               |
| Version           | 0.1.0                         |
| Status            | Draft                         |
| Author            | BuildSphere Team              |
| Last Updated      | 2026-07-14                    |
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
- Generated Terraform must not contain AWS credentials, active backend values,
  state, plans, kubeconfig, or provider tokens.
- Phase 9 kubeconfig inspection must keep source text and all credential-bearing
  fields in request memory only. Persistent targets contain redacted metadata,
  never credentials.
- Phase 9 execution credentials must be minimized to the selected context and
  encrypted with a dedicated AES-256-GCM key. Ciphertext is stored separately
  from target metadata and authenticated data binds it to the owner and target.
- Kubernetes object bodies, API error bodies, environment values, and decrypted
  kubeconfig must never enter logs, operation history, notifications, or API
  responses.
- BuildSphere's production Helm chart references an operator-created Secret and
  must render no Secret resource or credential value.
- Runtime images must not contain `.env`, source-control metadata, local caches,
  or development dependency sets. Image tags must be explicit and cannot be
  `latest`.
- Metrics must never label raw paths, URLs, query values, headers, bodies,
  identities, project IDs, correlation IDs, credentials, or error text. Use
  matched route templates, a single `unmatched` fallback, and `OTHER` for
  uncommon HTTP methods.
- Metrics endpoints stay on internal backend Services and are not exposed by
  the platform ingress.

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

| Threat                                  | Control                                                                                                                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stolen password                         | Hash passwords, enforce minimum length.                                                                                                                                             |
| Unauthorized project access             | Owner checks on project APIs.                                                                                                                                                       |
| Secret leakage in generated files       | Use placeholders and warnings.                                                                                                                                                      |
| Prompt injection through project files  | Treat input as untrusted data.                                                                                                                                                      |
| Broken deployment config                | Validate generated YAML before use.                                                                                                                                                 |
| OAuth callback forgery                  | Signed expiring state and PKCE verifier binding.                                                                                                                                    |
| Provider token disclosure               | AES-GCM encryption at rest and no frontend token exposure.                                                                                                                          |
| Account-link takeover                   | Link only from a verified GitHub email or an existing stable GitHub user ID.                                                                                                        |
| Cross-project repository publishing     | Project Service verifies ownership before invoking internal provider operations.                                                                                                    |
| Generated path traversal                | Reject absolute, empty, duplicate, and parent-traversal file paths before GitHub writes.                                                                                            |
| Partial repository publish              | Persist the repository link immediately and make later publishes idempotent file updates.                                                                                           |
| Stale provider credentials              | Refresh before expiry and require reauthorization when the refresh token is absent or expired.                                                                                      |
| Helm source treated as deployed YAML    | Validate only rendered raw Kubernetes manifests; Helm expressions remain source until an operator renders the chart.                                                                |
| Accidental Terraform cloud provisioning | Default `enable_cluster` to false; keep generated CI to format/init-without-backend/validate and require explicit IAM, endpoint, state, and cost review outside BuildSphere.        |
| Terraform state or credential leakage   | Generate only non-secret examples, keep the backend example inactive, and ignore private variables, local state, plans, caches, and crash files.                                    |
| Kubeconfig credential disclosure        | Parse kubeconfig ephemerally, never log request bodies, return only an allowlisted summary, and prohibit raw config or credential fields in target JSON.                            |
| Premature cluster mutation              | Keep execution disabled by default; require an exact host/environment policy, encrypted retained credential, owned artifact digest, expiring approval, and durable operation audit. |
| Kubeconfig-driven SSRF                  | Require HTTPS, prohibit proxy configuration, and permit execution only for exact configured API-server `host:port` values.                                                          |
| Kubeconfig command execution            | Reject exec plugins, auth providers, local file references, and impersonation before encrypted retention or client creation.                                                        |
| Credential database disclosure          | Minimize the selected context, encrypt with AES-256-GCM and owner/target authenticated data, and support explicit revocation.                                                       |
| Accidental or replayed deployment       | Bind an immutable artifact digest to a five-minute single-use approval and a durable idempotency key.                                                                               |
| Cross-namespace or cluster mutation     | Restrict execution to the target namespace and allow only the matching Namespace as a cluster-scoped resource.                                                                      |
| Resource takeover                       | Pre-read existing resources, require exact BuildSphere ownership labels, and use server-side apply with `force=false`.                                                              |
| Concurrent mutation                     | Enforce one active operation per target with a partial unique database index.                                                                                                       |
| Unbounded provider failure              | Apply request/operation timeouts, retry only transient failures, cap retries at three, and persist redacted errors.                                                                 |
| Destructive rollback                    | Require a second approval, restore only a prior successful snapshot, verify ownership before pruning, and never delete Namespace or cluster-scoped resources.                       |
| Secret disclosure in release manifests  | Keep runtime values in an external Secret, render only its name, and structurally assert that the production chart emits zero Secret resources.                                     |
| Privileged application container        | Run as non-root with read-only root filesystems, seccomp RuntimeDefault, dropped capabilities, no privilege escalation, bounded resources, and memory-backed `/tmp`.                |
| Kubernetes API token exposure           | Give every workload a dedicated ServiceAccount and set `automountServiceAccountToken: false` on accounts and pods.                                                                  |
| Unreviewed database schema drift        | Run the idempotent migration entrypoint as a bounded pre-install/pre-upgrade hook and fail the Helm release when migration fails.                                                   |
| Accidental external release             | Keep CI to lint, tests, structural verification, and no-push image builds; require separate approval and configuration for registry or external-cluster actions.                    |
| Mutable release selection               | Reject empty and `latest` image tags in the values schema and template validation.                                                                                                  |
| Metric cardinality or identifier leak   | Permit only stable service, method, matched-route, and status labels; collapse unknown paths to `unmatched`; exclude scrape traffic.                                                |
| Public metric disclosure                | Keep `/metrics` on internal backend Services, select targets explicitly, and create no metrics ingress or monitoring credential.                                                    |

# Audit logs

BuildSphere records deployment approvals, operations, per-resource outcomes,
status refreshes, and rollback results in Phase 9. Future versions should also
record:

- Login events.
- Project creation.
- Pipeline generation.
- Provider connection changes.
