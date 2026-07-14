# BuildSphere Helm Infrastructure

`buildsphere/` is the Phase 10-11 chart for deploying and observing the
BuildSphere platform.
It is distinct from `templates/helm/`, which Project Service uses to generate
charts for user projects.

The production chart expects external PostgreSQL, an operator-created runtime
Secret, and operator-managed ingress/TLS infrastructure. Phase 11 adds backend
metric discovery plus opt-in Prometheus Operator resources; the chart does not
install a monitoring stack. See `buildsphere/README.md` for its values contract
and verification commands.
