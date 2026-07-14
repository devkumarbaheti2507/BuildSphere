# BuildSphere Kubernetes Infrastructure

The raw files in this directory are early namespace examples and are not the
Phase 10 platform release definition.

Use `infrastructure/helm/buildsphere/` to render or install BuildSphere itself.
Use `templates/kubernetes/` and `templates/helm/` only as Project Service source
for generated user-project assets.

Production cluster provisioning, ingress installation, certificate management,
external secrets, and database operations remain outside this repository's
completed scope.
