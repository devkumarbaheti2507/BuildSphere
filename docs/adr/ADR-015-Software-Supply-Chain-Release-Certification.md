# ADR-015: Use digest-bound keyless release certification

Status: Accepted

Date: 2026-07-15

## Context

Phases 10-12 make BuildSphere reproducibly buildable, observable, and safer to
run in Kubernetes, but the deployment chart still identifies application
images by a shared mutable tag. The CI workflow proves that images build but
does not establish which exact image bytes belong to a release, what packages
they contain, whether known severe vulnerabilities were accepted, or which
trusted workflow produced them.

A long-lived signing key would create another production secret to distribute,
rotate, and protect. Publishing from normal pull-request or main-branch CI
would also grant registry authority to workflows that do not need it.

## Decision

Keep normal CI read-only and no-push. Add a separate release workflow triggered
only by semantic-version tags. Require the tagged commit to belong to the
default branch and route publishing through a GitHub environment that operators
can protect with required reviewers.

Pin every third-party action to a full commit SHA. Use a pinned,
checksum-verified Trivy binary rather than a floating scanner action. Build all
eleven images with OCI source metadata and BuildKit SBOM/provenance
attestations, scan the published immutable digest, and emit a CycloneDX SBOM.
Reject HIGH or CRITICAL vulnerabilities and detected secrets before signing.
Pin each production base image by exact version and manifest digest, with
reviewed Dependabot changes as the update path.

Sign accepted image digests and release files with Cosign keyless signing and
the release job's short-lived GitHub OIDC identity. Verify every signature
against the repository's exact workflow identity and GitHub token issuer before
assembling a release.

Generate a canonical release manifest that binds the source version and commit
to all image digests, SBOM hashes, chart hash, scan policy, and signing
identity. Generate a companion Helm values file that enables digest mode and
provides all eleven digests. Package these files as a draft GitHub Release for
human review. Release certification does not perform a deployment.

## Alternatives considered

- Continue deploying version tags. Rejected because registry tags can move and
  do not prove the bytes that were reviewed.
- Store a Cosign private key in GitHub Secrets. Rejected because a long-lived
  key adds rotation, recovery, and exfiltration risk where OIDC can provide a
  short-lived workload identity.
- Grant package-write permission to the existing CI workflow. Rejected because
  pull requests and ordinary main-branch builds require no registry mutation.
- Trust only BuildKit's generated attestations. Rejected because operators also
  need a portable, reviewable release manifest, SBOM files, scan policy, and
  digest-only deployment values.
- Publish a final GitHub Release automatically. Rejected because external
  staging evidence and an operator decision still belong after build-time
  certification.
- Deploy the candidate from the release workflow. Rejected because publication
  and environment deployment have different credentials, approvals, rollback,
  and audit boundaries.

## Consequences

- A production candidate is identified by eleven immutable digests, not one
  mutable tag.
- Release evidence can be reviewed and cryptographically verified before any
  cluster change.
- GitHub OIDC and Sigstore availability become release-time dependencies, but
  no signing private key is retained.
- GHCR publication, vulnerability database access, and GitHub environment
  protection are operator prerequisites for a live release.
- A failed scan may leave an unpromoted image digest in the registry; it cannot
  enter the signed evidence bundle or draft release.
- External staging deployment and runtime certification remain a separate,
  explicitly approved phase.
