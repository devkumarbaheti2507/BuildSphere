# Document Information

| Field             | Value                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------- |
| Document          | BuildSphere Software Supply-Chain Release Certification Spec                          |
| Version           | 0.1.0                                                                                 |
| Status            | Accepted                                                                              |
| Author            | BuildSphere Team                                                                      |
| Last Updated      | 2026-07-15                                                                            |
| Related Documents | ../docs/01_SRS.md, ../docs/adr/ADR-015-Software-Supply-Chain-Release-Certification.md |

---

# Purpose

Define Phase 13 release evidence for BuildSphere's own production images and
Helm package. This specification does not publish generated customer projects
or deploy a release candidate.

# Release entry and authority

- Normal CI has read-only repository permission and no package, OIDC, release,
  attestation, or deployment authority.
- A release starts only from a tag matching `v<major>.<minor>.<patch>` with an
  optional semantic-version prerelease suffix.
- The tagged commit must be contained in the repository's default branch.
- Image publication and final certification jobs use the `production-release`
  GitHub environment so repository operators can require reviewers.
- The workflow creates or updates only a draft GitHub Release for the exact
  source tag. Publishing that draft is a separate human action.

# Automation dependencies

- Every `uses:` reference in checked-in workflows is a full 40-character
  commit SHA with a human-readable release comment.
- Dependabot checks GitHub Actions, PNPM dependencies, and Docker base images
  weekly with bounded pull-request concurrency.
- The Trivy release archive version and Linux AMD64 SHA-256 checksum are
  explicit. Installation fails before extraction when the checksum differs.
- Release jobs use only the repository `GITHUB_TOKEN` and GitHub OIDC. No
  registry password or signing private key is required.

# Image build and scan contract

- The component set is exactly API Gateway, Auth, Project, Pipeline,
  Deployment, Monitoring, Logging, AI, Analytics, Notification, and Frontend.
- Runtime images carry OCI title, source, revision, version, and license labels.
- Node and Nginx base images use explicit version tags plus immutable
  multi-platform manifest digests; Dependabot proposes reviewed digest updates.
- The frontend uses Nginx's minimal Alpine runtime variant to exclude utilities
  that are not needed to serve the compiled application.
- The tagged version and full source commit are passed as non-secret build
  metadata.
- Backend runtime stages remove npm, Corepack, PNPM, and Yarn tooling after the
  application is assembled; services invoke the Node runtime directly.
- BuildKit pushes each image to GHCR with maximal provenance and an attached
  SBOM attestation. The workflow records the immutable output digest.
- Trivy scans the immutable `repository@sha256` reference for vulnerabilities
  and secrets. Any HIGH or CRITICAL finding blocks certification.
- Trivy emits one CycloneDX JSON SBOM for each accepted component.
- Cosign signs an image only after its scan succeeds.

# Component evidence

- Each matrix job emits one JSON record and one CycloneDX SBOM.
- A record contains schema version, component, repository, digest, version,
  source commit, SBOM path, and scan policy.
- Component, repository, digest, semantic version, commit, and SBOM shape are
  validated before the record is written.
- Component artifacts use unique names so parallel jobs cannot overwrite one
  another.

# Release evidence

- Certification requires exactly one record for each of the eleven components.
- Every record must share the same version, source commit, repository prefix,
  scan policy, and expected SBOM location.
- The certifier verifies every image signature against the exact release
  workflow identity and `https://token.actions.githubusercontent.com` issuer.
- The release manifest records the source repository/ref/workflow, all images,
  SHA-256 hashes of every SBOM, packaged chart metadata/hash, scan policy, and
  signing identity.
- JSON output is canonical and deterministic for identical inputs.
- Release SBOMs use unique root-level asset names so a flat GitHub Release
  download can be verified directly with `sha256sum --check SHA256SUMS`.
- The digest values file enables chart digest mode and supplies all eleven
  exact digests under one repository prefix.
- `SHA256SUMS` covers the manifest, values file, chart archive, and all SBOMs.
- Cosign keylessly signs the manifest and `SHA256SUMS` as blobs and stores
  verification bundles next to them.

# Helm digest mode

- Tag mode remains the default for local and no-push verification.
- Digest mode is disabled by default.
- Enabling digest mode requires exactly one value matching
  `sha256:[0-9a-f]{64}` for every application component.
- Deployment, migration, and chart-test image references use
  `<repository>/<component>@<digest>` in digest mode.
- No application image reference may contain a tag while digest mode is
  enabled.

# Verification

- A local verifier parses every workflow and rejects floating action refs or
  excessive default permissions.
- Fixture tests cover valid evidence, missing/duplicate/unknown components,
  inconsistent release identity, malformed digest, and invalid SBOM input.
- Helm strict lint and structured rendering cover default tag mode, complete
  digest mode, and missing/malformed digest failures.
- A disposable kind gate loads local images and completes install, migration,
  smoke, upgrade, and repeated smoke with exact digest-qualified references.
- Dockerfile checks cover OCI metadata and prohibit secret build arguments.
- CI runs Phase 13 verification after the Phase 10-12 chart gates.
- Existing workspace, image, PostgreSQL, Terraform, gateway, and disposable
  Kubernetes regressions remain green.

# Non-goals

- Publishing a real image or GitHub Release during local Phase 13 testing.
- Automatically publishing the draft release.
- Deploying to staging or production.
- Managing a registry retention policy or deleting failed image digests.
- Guaranteeing that vulnerability databases are complete or error-free.
- Creating a long-lived signing key, registry credential, or Kubernetes Secret.
- Database backup/restore, secret rotation, or external Secret integration.
