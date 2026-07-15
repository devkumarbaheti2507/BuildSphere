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
- BuildSphere production images, Helm chart, observability assets, and optional
  Kubernetes runtime reliability controls.
- Protected release workflow and deterministic supply-chain evidence tooling.

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
- All Deployments use safe rolling updates and soft topology spreading;
  selector-matched PDBs, HPAs, and exact ingress-only NetworkPolicies are
  optional.
- Certified releases resolve all 11 images, migration hooks, and chart tests by
  immutable digest. The workflow scans and inventories each digest, verifies
  and keylessly signs accepted images, signs canonical evidence, and creates a
  draft release only.
- PostgreSQL operations, secrets, ingress/TLS, monitoring servers, Metrics API,
  network enforcement, live registry credentials, protected-environment
  approval, and external deployment remain operator-owned. Local verification
  does not publish or sign externally.
