# Security Policy

## Supported code

Security fixes target the current `main` branch and the latest published
BuildSphere release candidate. This personal project does not promise support
for older versions.

## Reporting a vulnerability

Do not include credentials, access tokens, private kubeconfigs, exploit data,
or personal information in a public issue.

Use GitHub's private vulnerability-reporting feature when it is enabled for the
repository. Otherwise, contact the repository owner privately and provide:

- Affected commit or release.
- Reproduction steps.
- Expected and observed security boundary.
- Impact and any known workaround.

The maintainer will acknowledge a usable report, investigate it, and coordinate
disclosure before publishing sensitive details.

## Release evidence

Phase 13 release candidates include digest-qualified images, CycloneDX SBOMs,
provenance, vulnerability scanning, keyless image signatures, signed checksums,
and a signed release manifest. Follow
`docs/17_RELEASE_CERTIFICATION.md` to verify that evidence before deployment.
