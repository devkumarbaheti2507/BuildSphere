# BuildSphere Helm Infrastructure

`buildsphere/` is the Phase 10 chart for deploying the BuildSphere platform.
It is distinct from `templates/helm/`, which Project Service uses to generate
charts for user projects.

The production chart expects external PostgreSQL, an operator-created runtime
Secret, and operator-managed ingress/TLS infrastructure. See
`buildsphere/README.md` for its values contract and verification commands.
