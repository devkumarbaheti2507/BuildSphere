# Document Information

| Field             | Value                                                 |
| ----------------- | ----------------------------------------------------- |
| Document          | Helm Generation Spec                                  |
| Version           | 0.1.0                                                 |
| Status            | Accepted                                              |
| Author            | BuildSphere Team                                      |
| Last Updated      | 2026-07-10                                            |
| Related Documents | PROJECT_SPEC.md, TEMPLATE_SPEC.md, DEPLOYMENT_SPEC.md |

---

# Purpose

Define optional Helm chart generation for Phase 7 without expanding
BuildSphere into a real deployment runner.

# Selection model

- Tool category: `packaging`.
- Tool key: `helm`.
- Helm requires the `deployment/kubernetes` selection.
- Removing Helm removes all `helm/` files from future artifacts.
- Existing projects without Helm keep their current raw Kubernetes output.

# Generated chart

The generated artifact contains:

```text
helm/
  Chart.yaml
  values.yaml
  templates/
    _helpers.tpl
    deployment.yaml
    service.yaml
    ingress.yaml
    NOTES.txt
```

`Chart.yaml` uses API version `v2`. Default values reflect the project
generation variables for image repository and tag, replica count, container
port, ingress host, probes, and resource requests and limits.

# Rendering boundary

BuildSphere resolves named placeholders such as `{{serviceName}}` before the
artifact is stored. Helm expressions start with Helm syntax such as `.Values`,
`.Release`, `include`, or control delimiters and must remain byte-for-byte
available for Helm to render later.

# Chart behavior

- The Deployment uses stable selector labels, readiness and liveness probes,
  and configurable resources.
- The Service defaults to `ClusterIP` and exposes a configurable port.
- Ingress is enabled through values and uses the generated local host by
  default.
- Resource names and labels use namespaced helper templates.
- The chart contains no credentials or generated Kubernetes Secret values.
- Installation notes show a useful endpoint according to ingress settings.

# Validation and CI

- Project Service validates the Helm-to-Kubernetes dependency before saving
  tool selections.
- The template catalog resolves only categories implied by selected tools.
- Deployment Service validates raw `kubernetes/` YAML and ignores `helm/`
  chart source.
- Generated GitHub Actions checks the chart's required files when
  `helm/Chart.yaml` is present.
- Local verification asserts generated chart structure and preserved Helm
  expressions. A real `helm lint` command is optional when the Helm CLI is
  installed and is not a runtime dependency of BuildSphere.

# Non-goals

- Installing, upgrading, rolling back, or uninstalling a Helm release.
- Accessing kubeconfig or a Kubernetes API server.
- Managing encrypted secret values.
- Publishing charts to an OCI registry.

# Acceptance criteria

- The wizard can opt a Kubernetes project into Helm.
- Helm without Kubernetes returns a structured business error.
- A Helm-enabled project generates the complete chart listed above.
- A project without Helm generates no `helm/` paths.
- BuildSphere placeholders are resolved and Helm expressions remain intact.
- Existing artifact preview, download, GitHub publishing, and regression tests
  continue to work.
