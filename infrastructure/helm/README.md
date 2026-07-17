# BuildSphere Helm Infrastructure

`buildsphere/` is the Phase 10-14 chart for deploying, observing, and protecting
the runtime of the BuildSphere platform.
It is distinct from `templates/helm/`, which Project Service uses to generate
charts for user projects.

The production chart expects external PostgreSQL, an operator-created runtime
Secret, and operator-managed ingress/TLS infrastructure. Phase 11 adds backend
metric discovery plus opt-in Prometheus Operator resources; the chart does not
install a monitoring stack. Phase 12 adds safe rollout/topology defaults plus
opt-in disruption budgets, autoscaling, and ingress-only NetworkPolicies; it
does not install their cluster dependencies. Phase 13 adds fail-closed image
digest resolution for certified releases while retaining tag mode for local
development. Phase 14 adds the shared pod identity used by the separate
`buildsphere-personal-prerequisites/` chart, which installs persistent
PostgreSQL and optional namespaced TLS resources without rendering credentials.
See each chart's README for its values contract and verification commands.
