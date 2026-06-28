# Document Information

| Field | Value |
| --- | --- |
| Document | Deployment Spec |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
| Related Documents | ../docs/08_DEVOPS.md |

---

# Purpose

Define deployment target and generated deployment asset behavior.

# MVP deployment behavior

BuildSphere generates deployment-ready Kubernetes YAML. It does not perform real cluster deployment by default.

# Deployment target fields

- id
- projectId
- name
- type
- environment
- config

# MVP generated files

- namespace.yaml
- deployment.yaml
- service.yaml
- ingress.yaml

# Rules

- Generated manifests must include labels.
- Deployment should include readiness and liveness probe placeholders.
- Secrets must be represented as placeholders, not values.

# Future behavior

- Validate kubeconfig.
- Apply manifests to cluster.
- Track deployment status.
- Rollback deployment.
