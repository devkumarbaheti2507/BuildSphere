# Decisions Log

## 2026-06-28

- Product name selected: BuildSphere.
- Architecture direction: microservice-oriented platform.
- MVP language direction: TypeScript.
- MVP database: PostgreSQL.
- MVP CI/CD provider: GitHub Actions.
- MVP AI mode: rule-based and mock provider first.

## 2026-07-14

- Phase 11 uses isolated `prom-client` registries in every backend and bounded
  matched-route labels for HTTP metrics.
- Prometheus, Grafana, Alertmanager, data retention, and receiver credentials
  remain operator-owned; the chart provides optional discovery and rule assets
  but does not install a monitoring stack.

## 2026-07-15

- Phase 12 applies zero-unavailable rolling updates and soft hostname topology
  spread to every platform Deployment by default.
- PodDisruptionBudgets, autoscaling/v2 HPAs, and ingress-only NetworkPolicies
  remain opt-in so the one-node, no-Metrics-API baseline stays installable.
- Helm omits Deployment replicas while HPA is enabled, and PDB validation uses
  the HPA minimum as its effective replica count.
- Network isolation encodes exact same-release callers and selected external
  ingress/metrics peers. Egress stays unrestricted until environment-owned DNS,
  database, GitHub, and Kubernetes API destinations can be modeled safely.
- Metrics API, CNI enforcement, ingress controller, and metrics collector
  lifecycle remain operator-owned cluster responsibilities.
- Phase 13 separates read-only CI from a semantic-version release workflow;
  package-write and OIDC authority require the protected `production-release`
  environment.
- The canonical release unit is all 11 BuildSphere components. Certification
  and Helm digest mode fail closed when any component evidence or digest is
  missing, duplicated, unknown, malformed, or inconsistent.
- Images are scanned by immutable digest before keyless signing. CycloneDX
  SBOMs, BuildKit provenance, source identity, chart hash, digest values, and
  checksums are bound into deterministic release evidence.
- Release automation creates only a draft GitHub Release and never deploys.
  Human review and separately authorized external deployment remain required.
- Local Phase 13 verification performs no registry push, OIDC exchange,
  signature publication, GitHub Release creation, or external deployment.
