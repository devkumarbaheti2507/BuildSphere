# ADR-010: Ephemeral kubeconfig inspection and offline deployment planning

Status: Accepted

Date: 2026-07-11

## Context

Phase 8 generates Kubernetes, Helm, and AWS EKS Terraform source but grants no
runtime deployment authority. Moving directly to cluster apply would require
BuildSphere to retain credentials, define resource ownership, authorize
mutations, record audits, handle partial failure, observe rollouts, and roll
back safely. Those controls do not yet exist.

The existing Deployment Service already owns target records and structural
manifest validation. It is therefore the appropriate boundary for the first
Kubernetes integration slice, provided credential-bearing kubeconfig data does
not enter durable storage.

## Decision

BS-801 will use the official `@kubernetes/client-node` library to parse
kubeconfig supplied in an authenticated request. Source text is request-scoped
and discarded after parsing. The service returns and may persist only an
allowlisted summary: current context, cluster name, API server host, default
namespace, credential mechanism, TLS-verification posture, and context count.

Deployment Service can then build an ordered plan from an inspected target and
rendered Kubernetes manifests. Plans describe intended apply actions but are
always marked `executable: false` and `clusterRequestMade: false`. The service
does not create an API client or contact the cluster in BS-801.

## Alternatives considered

- Persist the complete kubeconfig encrypted immediately. Rejected because key
  ownership, rotation, revocation, audit, and external-secret alternatives need
  a separate security decision.
- Read the developer machine's default kubeconfig. Rejected because it would
  silently grant ambient authority and make local behavior non-portable.
- Invoke `kubectl --dry-run=client`. Rejected because it adds a binary/runtime
  dependency and still does not establish the future API-client boundary.
- Apply directly to a local cluster. Rejected until approvals, resource
  ownership, idempotency, status, and rollback are specified.

## Consequences

- Users can verify that BuildSphere understands their selected context without
  giving it durable cluster credentials.
- Target records become useful readiness metadata while remaining safe to
  inspect and share.
- Offline plans provide an explainable review surface and a stable input to the
  later executor.
- BS-801 cannot prove network reachability, authorization, admission behavior,
  or server-side validity because it intentionally makes no cluster request.
- BS-802 must introduce a separately reviewed credential and execution model
  before any real deployment is attempted.
