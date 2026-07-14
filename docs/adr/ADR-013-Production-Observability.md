# ADR-013: Use isolated Prometheus registries and optional operator resources

Status: Accepted

Date: 2026-07-14

## Context

BuildSphere exposes health endpoints, structured logs, and Monitoring Service
health gauges, but it has no consistent request-rate, error, latency, or
runtime metric contract across services. Production reliability and release
decisions cannot be made safely without those signals. The repository also
must remain deployable when Prometheus Operator CRDs are absent, and tests
create multiple Express applications in one Node.js process.

## Decision

Use the established `prom-client` library in Service Core. Create an isolated
registry for every Express application instead of using the global registry.
Collect standard Node.js/process metrics and shared HTTP request count,
duration, and in-flight metrics. Apply a constant service label and derive the
route label only from the matched Express route template; use `unmatched` when
there is no matched route. Do not collect `/metrics` scrapes as HTTP traffic.

Expose `GET /metrics` on every backend's existing internal HTTP port. Keep the
endpoint unauthenticated for Prometheus pull collection, but do not add it to
the public ingress contract. Monitoring Service appends its aggregate
availability gauges to its isolated registry output.

Annotate backend Services for conventional Prometheus discovery. Render a
`ServiceMonitor` and `PrometheusRule` only when explicitly enabled. Prometheus,
Grafana, and Alertmanager remain operator-owned dependencies. Keep a versioned
Grafana dashboard and runbooks in the repository so the metric and response
contracts can be reviewed without a live monitoring installation.

## Alternatives considered

- Hand-build Prometheus exposition text for all service metrics. Rejected
  because histogram, runtime, content-type, and registry behavior are mature
  concerns already handled by the standard client.
- Use the process-global registry. Rejected because unit tests and composed
  processes can instantiate more than one application and would collide on
  metric registration.
- Label metrics with `request.path` or `originalUrl`. Rejected because user IDs,
  project IDs, query values, and unbounded paths create cardinality and privacy
  risks.
- Install Prometheus Operator as a chart dependency. Rejected because platform
  monitoring ownership and lifecycle are separate from the application
  release.
- Require authentication on `/metrics`. Rejected for the baseline because
  Prometheus scraping would require distributing application credentials;
  cluster network controls will protect internal endpoints in a later runtime
  security phase.

## Consequences

- All services share one reviewed metric implementation and naming contract.
- Metric instances remain isolated and deterministic in tests.
- Operators can use annotation discovery or opt into Prometheus Operator
  resources without changing application images.
- Raw request paths and user data are excluded from metric labels.
- The default Helm release still needs no monitoring CRDs.
- Network policy, monitoring-stack installation, long-term retention,
  Alertmanager routing, and distributed tracing remain later milestones.
