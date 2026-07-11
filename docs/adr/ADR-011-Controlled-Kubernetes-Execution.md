# ADR-011: Controlled Kubernetes execution and bounded rollback

Status: Accepted

Date: 2026-07-11

## Context

BS-801 proves that BuildSphere can inspect kubeconfig and plan generated
resources without retaining credentials or contacting a cluster. BS-802 and
BS-803 add mutation authority, which creates new risks: credential disclosure,
kubeconfig-driven server-side request forgery, accidental cross-namespace or
cluster-wide changes, replayed approvals, concurrent deployments, partial
apply, ambiguous ownership, unbounded network calls, and destructive rollback.

Deployment Service already owns target metadata and planning. Project Service
owns generated artifacts, and Notification Service owns user event history.
The execution design must preserve those boundaries and keep preflight useful
when execution is not configured.

## Decision

Kubernetes execution is an opt-in Deployment Service capability. It remains
disabled unless all of these settings are present and valid:

- `KUBERNETES_EXECUTION_ENABLED=true`.
- A dedicated base64-encoded 32-byte
  `KUBERNETES_CREDENTIAL_ENCRYPTION_KEY`.
- An exact `host:port` allowlist in `KUBERNETES_ALLOWED_SERVER_HOSTS`.
- An allowed target-environment list. The default is `development`; production
  is not an accepted default.

Credential retention is a separate authenticated action. Deployment Service
keeps only the selected context, cluster, and user, rejects local file,
proxy, impersonation, exec, and auth-provider configuration, requires HTTPS
with certificate verification, then encrypts the minimized kubeconfig with
AES-256-GCM. Authenticated additional data binds ciphertext to the owner and
target. Public target JSON contains only redacted connection metadata and a
credential-availability timestamp.

Execution is bound to an immutable generated artifact loaded from Project
Service with the user's BuildSphere authorization. A five-minute, single-use
approval records the owner, target, artifact, exact manifest digest, action,
expiry, and credential fingerprint. Execution also requires a client-generated
idempotency key. The approval is consumed and the durable operation is created
in one database transaction; concurrent active operations for one target are
rejected, and credential replacement after approval fails closed.

Before mutation, Deployment Service enforces these rules:

- Only the target namespace may be used.
- `Namespace` is the only cluster-scoped kind accepted, and its name must equal
  the target namespace.
- Populated or empty `Secret` resources, custom resources, CRDs, webhooks,
  cluster RBAC, and unknown kinds are not executable in Phase 9.
- Existing non-Namespace resources must carry matching BuildSphere owner,
  project, and target labels. Existing namespaces are reused without being
  claimed or deleted.

New resources are created with BuildSphere ownership metadata. Existing owned
resources are updated with Kubernetes server-side apply using a stable field
manager and `force=false`. Transient requests receive a small bounded retry
budget, every request and operation has a timeout, and errors are reduced to
safe structured codes before persistence or response.

Operation and per-resource results are durable audit records. Status refresh
uses read-only Kubernetes requests and reports present, progressing, ready,
degraded, or missing states without returning live object bodies. Rollback
requires another expiring single-use approval and a prior successful apply.
It reapplies that prior immutable snapshot and deletes only namespaced
resources introduced by the newer release after verifying matching
BuildSphere ownership labels. Namespaces and cluster-scoped resources are never
deleted by rollback.

Rollback operations record both the release being rolled back and the earlier
release restored. Later approvals resolve the active release from successful
apply and rollback history, so a new deployment never rolls back to an obsolete
release merely because it was once successful.

## Alternatives considered

- Store plaintext kubeconfig. Rejected because database compromise would grant
  immediate cluster access.
- Read ambient machine or service-account credentials. Rejected because it
  creates invisible authority and breaks target ownership.
- Allow arbitrary kubeconfig server URLs. Rejected because an authenticated
  user could make Deployment Service contact internal infrastructure.
- Allow exec plugins. Rejected because kubeconfig could execute arbitrary
  commands inside Deployment Service.
- Force server-side apply conflicts. Rejected because BuildSphere must not take
  fields from another manager automatically.
- Use `kubectl` subprocesses. Rejected because the official Node client already
  provides typed, testable API access without another runtime binary.
- Roll back by deleting the namespace. Rejected as unbounded and destructive.
- Store only the latest release. Rejected because rollback and audit require an
  immutable prior successful snapshot.

## Consequences

- Preflight remains available without execution configuration.
- Operators must explicitly configure hosts, environments, encryption, and two
  user actions before apply or rollback.
- BuildSphere cannot execute dynamic cloud-provider kubeconfig plugins; users
  must provide a short-lived embedded token, basic credential, or client
  certificate for the selected test target.
- Phase 9 intentionally supports a constrained Kubernetes resource set rather
  than general cluster administration.
- Credential-key rotation requires reconnecting targets in this phase; a
  multi-key rotation mechanism remains future work.
- A disposable local cluster can validate real API behavior without granting
  production or cloud authority.
