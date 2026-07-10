# Helm Templates

Phase 7 uses these source files to generate an optional application chart for
projects that select both Kubernetes and Helm.

BuildSphere placeholders such as `{{serviceName}}` are resolved by Project
Service. Helm expressions such as `{{ .Values.replicaCount }}` remain in the
artifact for the Helm CLI to render later.

The generated chart contains no credentials and BuildSphere does not install
it into a cluster.
