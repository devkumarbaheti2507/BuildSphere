# Document Information

| Field             | Value                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| Document          | BuildSphere Production Observability and SLO Spec                     |
| Version           | 0.1.0                                                                 |
| Status            | Accepted                                                              |
| Author            | BuildSphere Team                                                      |
| Last Updated      | 2026-07-14                                                            |
| Related Documents | ../docs/08_DEVOPS.md, ../docs/adr/ADR-013-Production-Observability.md |

---

# Purpose

Define Phase 11 metrics, discovery, SLO, dashboard, and alert-response
contracts for BuildSphere itself. This specification does not install or
operate an external monitoring platform.

# Service metric contract

Every backend service exposes `GET /metrics` on its existing internal HTTP
port. The response uses the Prometheus text exposition content type and
contains:

- Standard Node.js and process metrics prefixed with `buildsphere_`.
- `buildsphere_http_requests_total` counter.
- `buildsphere_http_request_duration_seconds` histogram.
- `buildsphere_http_requests_in_flight` gauge.

All metric families use a constant `service` label. HTTP metrics may
additionally use normalized `method`, matched `route`, and `status_code`.
Methods outside the supported HTTP command set collapse to `OTHER`. No other
request-derived label is allowed. A missing route is `unmatched`; raw path,
URL, query, headers, body, identity, project, correlation, and credential
values are prohibited.

The duration histogram uses seconds and buckets suitable for interactive HTTP
requests. `/metrics` traffic is excluded from HTTP metrics. Registry instances
are application-local so repeated tests and composed processes do not share
mutable metric state.

# Monitoring Service contract

Monitoring Service exposes the shared runtime and HTTP families plus:

- `buildsphere_service_up` gauge for each configured health target.
- `buildsphere_service_health_response_milliseconds` gauge for each target.

Health collection keeps the existing three-second per-target timeout and does
not include response bodies or error text in metrics.

# Kubernetes discovery

Backend Services carry `buildsphere.io/metrics: "true"`. Conventional
Prometheus scrape annotations are configurable and enabled by default. The
frontend is never selected because it has no application metrics endpoint.

The optional ServiceMonitor:

- Selects only the metrics-capable Services in the release.
- Scrapes named port `http` at `/metrics`.
- Uses configurable interval, timeout, labels, and target namespace.
- Is disabled by default and requires operator-installed CRDs.

# SLO and alert contract

The primary user-facing API SLO is measured at API Gateway over a rolling
30-day objective:

- Availability objective: 99.9% of eligible requests do not return 5xx.
- Latency objective: 95% of eligible requests complete within 750 ms.
- `/health` and unmatched requests are excluded from user-journey SLO queries.

The configured latency threshold must equal one of the shared histogram bucket
boundaries so the long-window latency SLI can be calculated directly and
consistently.

The optional PrometheusRule provides recording rules for request rate,
server-error ratio, and p95 latency. Alerts cover:

- A monitored BuildSphere service unavailable for five minutes.
- API Gateway server-error ratio above the configured fast-burn threshold.
- API Gateway p95 latency above the configured threshold.

Alert annotations identify a checked-in runbook. Alert routing, paging policy,
maintenance windows, and receiver credentials belong to external Alertmanager
configuration.

# Dashboard and runbooks

The versioned Grafana dashboard uses a selectable Prometheus data source and
shows service availability, API request rate, server-error ratio, p95 latency,
in-flight requests, memory, and event-loop lag. It contains no credentials or
fixed external endpoint.

Runbooks state impact, signals, diagnosis, mitigation, escalation, and recovery
verification. They do not include secrets or environment-specific credentials.

# Verification

- Shared unit tests verify metric names, content type, route normalization,
  unmatched-path redaction, scrape exclusion, and registry isolation.
- Service API tests verify all backend app factories expose metrics.
- Helm strict lint and structural parsing verify discovery labels,
  annotations, optional resources, selectors, endpoints, and rule names.
- Dashboard JSON and runbook references are parsed and checked.
- The chart test scrapes every backend metrics endpoint in a disposable cluster.
- Full Phase 0-10 workspace, image, PostgreSQL, Terraform, and Kubernetes
  regressions remain green.

# Non-goals

- Installing or configuring Prometheus, Grafana, Alertmanager, or an operator.
- Publicly exposing `/metrics` through ingress.
- Alert receiver credentials or on-call schedules.
- Centralized log storage or retention.
- Distributed tracing or OpenTelemetry collection.
- NetworkPolicy, autoscaling, high availability, or disaster recovery.
