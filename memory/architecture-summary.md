# Architecture Summary

BuildSphere has these major components:

- Frontend web app.
- API Gateway.
- Auth Service.
- Project Service.
- Pipeline Service.
- Deployment Service.
- Logging Service.
- Monitoring Service.
- AI Service.
- Notification Service.
- Analytics Service.
- Shared types package.
- Shared Service Core, including isolated Prometheus registries.
- Template library.
- BuildSphere production images, Helm chart, and observability assets.

MVP communication:

- REST over HTTP.

Runtime data:

- PostgreSQL for durable records.
- In-memory repositories for non-durable local verification.
- Redis and MinIO are prepared local dependencies, not active runtime stores.
- Generated artifacts currently live in PostgreSQL JSONB.

Production boundary:

- BuildSphere packages 11 non-root images and a hardened platform Helm release.
- Every backend exposes bounded Prometheus runtime and HTTP metrics.
- Optional ServiceMonitor, PrometheusRule, Grafana dashboard, SLO, and runbook
  assets integrate with an operator-owned monitoring stack.
- PostgreSQL operations, secrets, ingress/TLS, monitoring servers, registries,
  and external deployment remain operator-owned.
