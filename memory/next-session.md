# Next Session

Recommended next task:

Recover the first personal free-tier release candidate, certify it, and then
continue the deployment interactively. Begin with one operator action at a
time and verify each result before continuing.

Immediate tasks:

1. Commit and push the Cosign compatibility fix, then confirm normal CI passes
   on `main`.
2. Keep the failed `v0.5.0` tag and images as immutable audit evidence; do not
   move, delete, or reuse that version.
3. With explicit approval, create and review a fresh `v0.5.1` candidate so the
   protected workflow can publish and sign the eleven AMD64/ARM64 indexes and
   create the draft evidence bundle.
4. Verify the draft's 25 checksums, manifest/checksum signatures, all eleven
   image signatures, and schema-2 platform evidence before using its digest
   values. Only then change required GHCR package visibility for deployment.
5. Guide the owner through a current free-tier VM choice, firewall, SSH, K3s,
   Helm, cert-manager, hostname, Secret bootstrap, prerequisite release, and
   main release. Recheck provider limits and installation versions from
   official sources at deployment time.
6. Add an off-host PostgreSQL backup and perform a restore rehearsal before the
   personal environment holds data that matters.

Current evidence:

- Phases 0-14 are complete locally.
- Main chart `0.5.0` retains 38 default resources and zero Secrets.
- Prerequisite chart `0.1.0` renders five default resources and zero Secrets;
  TLS opt-in adds one namespaced Issuer and Certificate.
- The protected workflow targets exactly `linux/amd64` and `linux/arm64` for
  all eleven components, with per-platform scans and 22 SBOMs.
- Evidence schema 2 produces 25 checksum entries and 26 release files; schema
  1 remains green for Phase 13 regression fixtures.
- All 25 GitHub Action references are full-SHA pinned and actionlint passes.
- Context mismatch, existing Secret, server dry-run, generated credential,
  optional GitHub OAuth, and non-disclosure bootstrap checks pass.
- Representative backend and frontend ARM64 OCI cross-builds pass without a
  push.
- A disposable kind cluster installed persistent PostgreSQL and all eleven
  digest-pinned application workloads, applied seven migrations, passed both
  Helm tests, upgraded both releases, repeated both tests, and was deleted.
- Node 22 frozen install, lint, all builds and 63 tests, the 26-file gateway
  flow, Phase 6/9 PostgreSQL, Terraform validation, and Phase 10-13 focused
  regressions pass.
- The repository is public and the `production-release` GitHub environment is
  configured.
- Live candidate `v0.5.0` built, scanned, and pushed all eleven multi-platform
  indexes, then failed every matrix job at Cosign image signing because the
  workflow used singular `--annotation`. It created no draft release.
- The workflow now uses plural `--annotations` and pins Cosign `v3.0.6` in
  both jobs. Phase 13, Phase 14, and actionlint verification pass locally.

Deployment boundaries still open:

- The live `v0.5.0` tag and unsigned GHCR indexes exist but are a failed,
  non-deployable candidate. No successful OIDC image/evidence signature, draft
  GitHub Release, or `v0.5.1` recovery candidate has been created.
- No personal cloud account, VM, firewall, SSH key, external Kubernetes
  cluster, DNS name, cert-manager installation, or public certificate has been
  created or changed.
- The single-node profile is not highly available. PostgreSQL backup/restore,
  Secret rotation, host patching, capacity monitoring, and recovery remain
  operator responsibilities.
- PDB, HPA, monitoring CRDs, application NetworkPolicies, and controlled
  Kubernetes execution remain disabled in the initial personal profile.
- Production HA, managed Secrets, multi-zone scheduling, load testing,
  centralized logs/traces, alert routing, and formal staging promotion remain
  future separately specified work.

Node `v22.23.1` remains the supported local runtime. Use official current
provider, K3s, cert-manager, GitHub, and OCI documentation during live
deployment because free-tier limits and installation versions can change.
