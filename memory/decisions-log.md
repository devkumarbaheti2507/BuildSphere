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
