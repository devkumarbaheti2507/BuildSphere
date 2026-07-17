# Document Information

| Field             | Value                                                                           |
| ----------------- | ------------------------------------------------------------------------------- |
| Document          | BuildSphere Personal Free-Tier Deployment Readiness Spec                        |
| Version           | 0.1.0                                                                           |
| Status            | Accepted                                                                        |
| Author            | BuildSphere Team                                                                |
| Last Updated      | 2026-07-15                                                                      |
| Related Documents | ../docs/01_SRS.md, ../docs/adr/ADR-016-Personal-Free-Tier-Deployment-Profile.md |

---

# Purpose

Define the repository prerequisites for installing BuildSphere on one
resource-constrained AMD64 or ARM64 K3s server. This spec prepares and verifies
artifacts locally; it does not create a cloud account or perform an external
deployment.

# Supported release platforms

- The supported set is exactly `linux/amd64` and `linux/arm64`, sorted in that
  order in canonical evidence.
- Each component tag resolves to one OCI index digest containing both platform
  manifests.
- QEMU is installed through a full-SHA-pinned GitHub Action before Buildx.
- Trivy scans the immutable index reference once per explicit platform using
  the same HIGH/CRITICAL vulnerability and secret policy.
- Each accepted platform emits
  `sbom/<component>-linux-<architecture>.cdx.json`.
- BuildKit retains maximal provenance and SBOM attestations for the
  multi-platform build. Cosign signs the immutable index digest only after both
  platform scans pass.

# Multi-platform component evidence

- Schema 2 component records contain the existing component identity, image,
  index digest, version, source commit, and scan policy.
- `platforms` is an exact two-entry array. Each entry contains only `name` and
  the canonical `sbomPath`.
- The bundler rejects missing, duplicate, reordered, unsupported, or
  inconsistent platform entries.
- Release manifest schema 2 retains one digest-qualified image reference and
  embeds both platform SBOM file names and SHA-256 values.
- Flat release assets use
  `buildsphere-<component>-linux-<architecture>.cdx.json`.
- `SHA256SUMS` covers 22 SBOMs, the chart, digest values, and manifest.
- Schema 1 component records remain accepted only for existing local Phase 13
  regression fixtures; the protected release workflow must emit schema 2.

# Personal prerequisite chart

- The chart name is `buildsphere-personal-prerequisites` and it remains a
  separate Helm release from `buildsphere`.
- PostgreSQL uses the reviewed official PostgreSQL 16 Alpine tag plus immutable
  multi-platform manifest digest.
- The chart renders one ServiceAccount, Service, StatefulSet, NetworkPolicy,
  and Helm test by default and zero Secret resources.
- The ServiceAccount and pod disable API-token mounting.
- PostgreSQL runs as the Alpine image's UID/GID 70 with RuntimeDefault seccomp, no privilege
  escalation, all capabilities dropped, and a read-only root filesystem.
- Writable paths are limited to the retained data PVC, a memory-backed socket
  directory, and a memory-backed temporary directory.
- The PVC defaults to 20 GiB and uses the cluster's default storage class unless
  the operator supplies one.
- The NetworkPolicy is ingress-only and admits port 5432 only from pods in the
  same namespace carrying `app.kubernetes.io/part-of: buildsphere`.
- The chart references an existing Secret containing `POSTGRES_DB`,
  `POSTGRES_USER`, and `POSTGRES_PASSWORD`.
- Optional TLS renders a namespaced cert-manager `Issuer` and `Certificate`
  with HTTP-01 through a configurable ingress class. It requires a valid email,
  DNS hostname, and target Secret name.

# Secret bootstrap

- The command requires `BUILDSPHERE_CONFIRM_CONTEXT` to equal
  `kubectl config current-context` exactly.
- The namespace defaults to `buildsphere` and must use a DNS label.
- Existing database or runtime Secrets cause a failure; the command never
  rotates them implicitly.
- Database passwords and service tokens use URL-safe random hex. Token
  encryption uses 32 random bytes encoded as Base64.
- Optional `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` must be supplied
  together. OAuth state and token-encryption values are generated when GitHub
  is configured.
- Generated values are passed directly to Kubernetes, are not printed, and are
  not written to a persistent file.
- The initial profile does not enable controlled Kubernetes deployment and does
  not generate `KUBERNETES_CREDENTIAL_ENCRYPTION_KEY`.

# Application values profile

- One replica is used for each application.
- PodDisruptionBudget, HPA, ServiceMonitor, PrometheusRule, and application
  NetworkPolicy resources are disabled.
- Ingress uses class `traefik`, one operator-replaced hostname, and the TLS
  Secret emitted by cert-manager.
- Deployment execution remains disabled.
- The runtime Secret name and public URL agree with the prerequisite and
  ingress values.
- Certified installation combines the release bundle's digest values first and
  the personal profile second.

# Verification

- Helm strict lint and structured parsing validate the prerequisite and main
  chart profile.
- Negative renders cover missing TLS identity, invalid email/hostname, empty
  Secret name, unsafe image reference, zero storage, and invalid PostgreSQL
  resource settings.
- Release evidence fixtures cover all 22 SBOMs and incomplete platform failure.
- Workflow checks require full-SHA QEMU setup, exact multi-platform build
  settings, two explicit Trivy platform scans, and schema-2 component evidence.
- Representative backend and frontend cross-builds validate ARM64 Dockerfile
  compatibility when Docker Buildx is available.
- A disposable kind test installs the prerequisite chart, runs its database
  test, installs BuildSphere, applies migrations, runs Helm tests, upgrades both
  releases, repeats tests, and deletes the cluster.
- Complete Phase 0-13 regressions remain green.

# Non-goals

- Creating an OCI, AWS, GCP, GitHub, DNS, or certificate-authority account.
- Applying Terraform or provisioning a VM, firewall, load balancer, or domain.
- Installing K3s, Helm, Traefik, or cert-manager on an external host.
- Database high availability, automated restore, or off-host backup.
- Automatic Secret rotation or an external Secrets operator.
- Claiming production availability, durability, capacity, or security
  certification for one free-tier server.
