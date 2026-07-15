# BuildSphere Helm Chart

This chart deploys the ten backend services and frontend that make up
BuildSphere. It is suitable for controlled staging evaluation after images,
PostgreSQL, runtime credentials, DNS, ingress, and TLS have been prepared by an
operator.

## Prerequisites

- Kubernetes 1.34-compatible cluster access.
- Helm 4-compatible CLI.
- Eleven BuildSphere images published under one repository prefix and either an
  explicit non-`latest` tag or the complete Phase 13 digest values overlay.
- Reachable PostgreSQL with migrations allowed from the target namespace.
- An existing Secret containing at least `DATABASE_URL`,
  `JWT_ACCESS_TOKEN_SECRET`, `JWT_REFRESH_TOKEN_SECRET`, and
  `INTERNAL_SERVICE_TOKEN`.
- An ingress controller and TLS Secret when ingress is enabled.
- Prometheus Operator CRDs only when `ServiceMonitor` or `PrometheusRule` is
  enabled.
- Kubernetes Metrics API only when horizontal autoscaling is enabled.
- A NetworkPolicy-enforcing network plugin and selectors matching the actual
  ingress controller and metrics collector when network policy is enabled.

Optional GitHub and Kubernetes execution variables belong in the same external
Secret. Do not put credential values in a checked-in Helm values file.

## Values

Create an environment-specific, non-secret values file outside the repository:

```yaml
publicUrl: https://buildsphere.example.com

image:
  repositoryPrefix: ghcr.io/example/buildsphere
  tag: "0.1.0"
  digestMode: false
  pullPolicy: IfNotPresent

runtime:
  existingSecret: buildsphere-runtime
  logLevel: info
  pipelineStageDelayMs: 700

ingress:
  enabled: true
  className: nginx
  host: buildsphere.example.com
  tls:
    enabled: true
    secretName: buildsphere-tls

observability:
  serviceMonitor:
    enabled: false
    additionalLabels:
      release: kube-prometheus-stack
  prometheusRule:
    enabled: false
    additionalLabels:
      release: kube-prometheus-stack

availability:
  podDisruptionBudget:
    enabled: true
    minAvailable: 1
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 5

networkPolicy:
  enabled: true
  ingressController:
    namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: ingress-nginx
    podSelector:
      matchLabels:
        app.kubernetes.io/name: ingress-nginx
  metricsCollector:
    namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: monitoring
    podSelector:
      matchLabels:
        app.kubernetes.io/name: prometheus
```

Kubernetes deployment execution, both Prometheus Operator resources, pod
disruption budgets, horizontal autoscaling, and network policies remain
disabled by default. Enabling execution also requires non-empty exact
API-server hosts, allowed environments, and the dedicated credential-encryption
key in the external Secret.

All Deployments use zero-unavailable rolling updates and soft hostname
topology spreading by default. A disruption budget requires at least two fixed
replicas, or an autoscaling minimum of at least two, and `minAvailable` must be
lower than that effective count. When autoscaling is enabled, HPAs own replica
count and the Deployments omit `spec.replicas`.

Network policies restrict ingress only. They permit the reviewed internal
service graph and chart tests, then use the configured namespace and pod
selectors for public ingress and backend metric collection. Confirm those
selectors against the target cluster before enabling policy. Egress remains
unrestricted because PostgreSQL, DNS, GitHub, and Kubernetes API destinations
are environment-specific.

All backend Services expose `/metrics` internally and carry scrape annotations
by default. The frontend is not a metric target. Enable `serviceMonitor` and
`prometheusRule` only when their CRDs already exist; labels and namespaces must
match the operator in the target environment. SLO defaults are 99.9% API
availability over 30 days and p95 latency within 750 ms. The checked-in
dashboard and alert runbooks live under `infrastructure/observability/` and
`docs/runbooks/`.

For a certified candidate, use the generated
`buildsphere-digest-values.yaml`. It sets `image.digestMode: true` and supplies
one `sha256` digest for every component. Digest mode applies to all
Deployments, the migration Job, and the chart test and fails rendering when any
digest is absent or malformed. It never falls back to `image.tag`.

## Validate and install

The namespace and runtime Secret must exist before installation because the
database migration is a pre-install hook.

```bash
helm lint --strict infrastructure/helm/buildsphere
helm template buildsphere infrastructure/helm/buildsphere \
  --namespace buildsphere \
  --values /path/to/staging-values.yaml
helm install buildsphere infrastructure/helm/buildsphere \
  --namespace buildsphere \
  --values /path/to/staging-values.yaml \
  --wait \
  --timeout 5m
helm test buildsphere --namespace buildsphere --logs --timeout 2m
```

The pre-install and pre-upgrade Job runs the idempotent migration runner. Use
the same values for an upgrade:

```bash
helm upgrade buildsphere infrastructure/helm/buildsphere \
  --namespace buildsphere \
  --values /path/to/staging-values.yaml \
  --wait \
  --timeout 5m
helm test buildsphere --namespace buildsphere --logs --timeout 2m
```

The Helm test checks frontend health, API Gateway routing to Auth Service, the
exact migration count, and every backend `/metrics` endpoint from inside the
namespace. `--wait` also requires all eleven Deployments to satisfy their
readiness probes.

## Repository verification

```bash
HELM_BIN=/path/to/helm pnpm verify:phase10
HELM_BIN=/path/to/helm PROMTOOL_BIN=/path/to/promtool pnpm verify:phase11
HELM_BIN=/path/to/helm pnpm verify:phase12
HELM_BIN=/path/to/helm ACTIONLINT_BIN=/path/to/actionlint pnpm verify:phase13
pnpm verify:phase10:images
KIND_BIN=/path/to/kind HELM_BIN=/path/to/helm pnpm verify:phase10:kind
KIND_BIN=/path/to/kind HELM_BIN=/path/to/helm pnpm verify:phase12:kind
```

The Phase 11 verifier checks the default no-CRD render, opt-in discovery and
alert resources, Prometheus rule syntax, bounded metric labels, dashboard
structure, runbook links, and invalid values. CI requires an explicit
`PROMTOOL_BIN`; local verification uses it when supplied.

The Phase 12 verifier checks default rollout and topology behavior, all opt-in
PDB/HPA/NetworkPolicy resources, replica ownership, exact caller selectors,
ports, and invalid safety combinations.

The Phase 13 verifier checks tag and complete digest modes, pinned base inputs
and actions, least-privilege workflows, scanner installers, deterministic
release evidence, SBOM and checksum integrity, and hostile evidence cases.

The kind verifier creates its own cluster, ephemeral PostgreSQL fixture, and
random test-only Secret; installs and tests revision one; upgrades and tests
revision two; then deletes the cluster. It never contacts an external cluster
or publishes an image.

The Phase 12 kind mode uses the same disposable lifecycle with two fixed
replicas per application, disruption budgets, and NetworkPolicies enabled. It
does not enable HPAs because the fixture intentionally does not install a
Metrics API.

## Security posture

- The production chart renders no Secret.
- Service-account tokens are disabled.
- Containers run non-root with read-only roots, seccomp, dropped capabilities,
  bounded resources, and writable memory-backed `/tmp` volumes only.
- Image tags must be explicit and cannot be `latest`.
- Certified releases use all-component digest mode and signed evidence instead
  of trusting tags.
- Ingress references an operator-managed TLS Secret.
- PostgreSQL and all credential lifecycle operations remain external.
- Metrics stay on internal Services; the chart creates no public metrics
  ingress, monitoring credential, or monitoring-stack workload.
- Rolling updates preserve available replicas and soft spreading remains
  compatible with single-node clusters.
- Optional disruption budgets reject singleton configurations.
- Optional ingress-only policies use exact release/component peers and render
  no broad peer, `ipBlock`, or egress restriction.
