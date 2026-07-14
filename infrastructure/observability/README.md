# BuildSphere Observability Assets

This directory contains versioned, provider-neutral assets for Phase 11.

- `grafana/buildsphere-overview.json` is a Grafana dashboard that queries the
  metrics defined in `specs/PRODUCTION_OBSERVABILITY_SPEC.md`.
- The dashboard selects a Prometheus datasource at import or provisioning
  time. It contains no endpoint or credential.
- The BuildSphere Helm chart can emit `ServiceMonitor` and `PrometheusRule`
  resources when their CRDs already exist.
- Alert response procedures live under `docs/runbooks/`.

BuildSphere does not install or operate Prometheus, Grafana, Alertmanager, or
Prometheus Operator in Phase 11.
