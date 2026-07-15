# BuildSphere Release Inputs

`components.json` is the canonical Phase 13 release component catalog. It
contains the ten backend image names and ports plus Frontend.

`scripts/create-release-evidence.mjs` uses this catalog to produce the release
matrix, validate one component record at a time, require the complete
eleven-component set, and generate the signed-release inputs.

The catalog is deliberately data-only. It contains no registry credential,
signing key, environment endpoint, mutable tag, or deployment instruction.
`pnpm verify:phase13` checks that it remains aligned with the Docker build
allowlist, Helm application components, and release workflow.
