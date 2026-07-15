# Document Information

| Field             | Value                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Document          | BuildSphere Release Certification Guide                                                                          |
| Version           | 0.1.0                                                                                                            |
| Status            | Accepted                                                                                                         |
| Author            | BuildSphere Team                                                                                                 |
| Last Updated      | 2026-07-15                                                                                                       |
| Related Documents | 08_DEVOPS.md, ../specs/SUPPLY_CHAIN_SECURITY_SPEC.md, adr/ADR-015-Software-Supply-Chain-Release-Certification.md |

---

# Purpose

This guide explains how an operator turns a reviewed BuildSphere commit into a
draft, cryptographically verifiable release candidate. The workflow publishes
images and release evidence only; it does not deploy to Kubernetes or publish
the draft as a final GitHub Release.

# One-time repository setup

1. Keep GitHub Actions allowed to read repository contents and publish packages
   with the repository `GITHUB_TOKEN`.
2. Create a GitHub environment named `production-release`.
3. Add required reviewers and prevent environment self-approval where the
   repository plan supports those controls.
4. Protect the default branch and require the normal CI workflow before merge.
5. Decide whether GHCR packages are public or grant intended operators read
   access to private packages.

No registry password or signing private key is required. Release jobs use
short-lived GitHub permissions and OIDC identity.

# Start a candidate

Create a semantic-version tag only after the release commit is merged into the
default branch:

```bash
git switch main
git pull --ff-only
git tag -a v0.4.0 -m "BuildSphere v0.4.0"
git push origin v0.4.0
```

The workflow rejects non-semantic tags and tags whose commit is not contained
in the default branch. The `production-release` environment can pause image
publication until a configured reviewer approves it.

# Certification stages

The release workflow:

1. Resolves the canonical ten backend components plus Frontend.
2. Builds each image from the tagged commit and pushes version and commit tags
   to GHCR.
3. Attaches BuildKit SBOM and maximal provenance attestations.
4. Scans the immutable digest with checksum-pinned Trivy for HIGH/CRITICAL
   vulnerabilities and secrets.
5. Emits one CycloneDX SBOM and signs each accepted digest with Cosign and
   GitHub OIDC.
6. Verifies all eleven signatures against the exact repository workflow
   identity.
7. Packages the Helm chart and creates a digest-only values overlay.
8. Binds source, digests, SBOM hashes, chart hash, scan policy, and signing
   identity in one canonical release manifest.
9. Creates `SHA256SUMS`, keylessly signs the manifest and checksums, and uploads
   everything to a draft GitHub Release.

A failed scan can leave an unpromoted digest in GHCR, but that digest is not
signed, included in the release manifest, or attached to the draft candidate.

# Draft contents

The draft release contains:

- `buildsphere-<version>.tgz`
- `buildsphere-digest-values.yaml`
- `buildsphere-release-manifest.json`
- `buildsphere-release-manifest.json.bundle`
- `SHA256SUMS`
- `SHA256SUMS.bundle`
- Eleven `buildsphere-<component>.cdx.json` files

The manifest is the authoritative binding. A version tag by itself is not
deployment evidence.

# Verify a candidate

Download the draft assets with an authenticated GitHub CLI, then check every
file hash. All checksum entries are root-level asset names, matching the flat
directory created by `gh release download`:

```bash
gh release download v0.4.0 --dir /tmp/buildsphere-v0.4.0
cd /tmp/buildsphere-v0.4.0
sha256sum --check SHA256SUMS
```

Verify the signed manifest and checksum list with the exact workflow identity:

```bash
IDENTITY="https://github.com/OWNER/REPOSITORY/.github/workflows/release.yml@refs/tags/v0.4.0"
ISSUER="https://token.actions.githubusercontent.com"

cosign verify-blob \
  --bundle buildsphere-release-manifest.json.bundle \
  --certificate-identity "${IDENTITY}" \
  --certificate-oidc-issuer "${ISSUER}" \
  buildsphere-release-manifest.json

cosign verify-blob \
  --bundle SHA256SUMS.bundle \
  --certificate-identity "${IDENTITY}" \
  --certificate-oidc-issuer "${ISSUER}" \
  SHA256SUMS
```

Each `images[].reference` in the manifest is already digest-qualified. Verify
those references with the same identity and issuer:

```bash
cosign verify \
  --certificate-identity "${IDENTITY}" \
  --certificate-oidc-issuer "${ISSUER}" \
  ghcr.io/owner/buildsphere/api-gateway@sha256:...
```

# Render without deploying

The generated values file activates fail-closed digest mode:

```bash
helm lint --strict infrastructure/helm/buildsphere
helm template buildsphere infrastructure/helm/buildsphere \
  --namespace buildsphere \
  --values /tmp/buildsphere-v0.4.0/buildsphere-digest-values.yaml \
  --values /path/to/staging-values.yaml \
  > /tmp/buildsphere-v0.4.0/rendered.yaml
```

Inspect the render and confirm that every application image uses
`repository/component@sha256:...`. Digest mode fails if any one of the eleven
digests is empty or malformed.

# Promotion boundary

Publishing the draft and deploying it are separate approvals. Before final
publication, run an approved external staging installation with the real
database, Secret provider, ingress, TLS, monitoring, and network prerequisites;
record smoke, rollback, capacity, and security evidence; then make a human
release decision.

Phase 13 local verification never pushes an image, requests a signing
certificate, creates a GitHub Release, or changes an external cluster.
