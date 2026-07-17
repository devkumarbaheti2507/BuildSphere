# ADR-016: Use a provider-neutral single-node deployment profile

## Status

Accepted.

## Context

BuildSphere's certified release is currently AMD64-only, while the strongest
long-lived free compute option available to the project owner is ARM64. The
platform chart also intentionally externalizes PostgreSQL, runtime Secrets,
ingress, and TLS. Deploying directly from ad hoc commands would bypass the
release evidence model and make the personal environment difficult to repeat or
review.

The target is a personal learning deployment, not a highly available production
environment. Cloud account creation and external mutation still require the
owner's explicit participation.

## Decision

- Publish one immutable multi-platform OCI index containing `linux/amd64` and
  `linux/arm64` for every BuildSphere component.
- Scan and inventory each platform separately, then bind both platform SBOMs to
  the component index digest in release evidence schema 2.
- Add a separate Helm chart for one persistent PostgreSQL instance and optional
  namespaced cert-manager resources. Keep the main BuildSphere chart's external
  database and Secret contracts unchanged.
- Generate database and runtime Secrets through an explicit, context-confirmed
  operator command. Do not render or commit those Secrets through Helm.
- Check in a conservative one-node values profile that uses Traefik and leaves
  scaling, disruption budgets, monitoring CRDs, application isolation, and
  deployment execution disabled initially.
- Keep implementation provider-neutral. OCI-specific account, VM, firewall,
  and free-tier instructions belong in the operator runbook, not runtime code.

## Alternatives considered

### Build ARM64 images manually on the server

Rejected because it bypasses the protected scan, SBOM, signing, and canonical
release evidence path and makes upgrades harder to reproduce.

### Replace the platform chart with Docker Compose

Rejected because it would create a second production topology and discard the
Helm, migration, health, security, and integration verification already owned
by Phases 10-13.

### Provision managed Kubernetes and managed PostgreSQL

Rejected because those services are not reliably permanent-free and would add
cloud credentials, provider coupling, and cost risk to a personal learning
deployment.

### Install PostgreSQL inside the main platform chart

Rejected because it would weaken the main chart's explicit external-state
boundary. A separate prerequisite release keeps lifecycle and ownership clear.

## Consequences

- One release can run on common x86 hosts and ARM64 free-tier instances.
- Release evidence grows from 11 to 22 CycloneDX assets and must validate
  platform completeness.
- Personal deployment gains a repeatable database and TLS prerequisite path
  without committing credentials.
- The environment remains single-node and is not highly available.
- Off-host backup, secret rotation, host provisioning, cert-manager
  installation, DNS, and cloud firewall configuration remain explicit operator
  responsibilities.
