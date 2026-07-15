# Document Information

| Field             | Value                                                                              |
| ----------------- | ---------------------------------------------------------------------------------- |
| Document          | BuildSphere Runtime Reliability and Network Security Spec                          |
| Version           | 0.1.0                                                                              |
| Status            | Accepted                                                                           |
| Author            | BuildSphere Team                                                                   |
| Last Updated      | 2026-07-15                                                                         |
| Related Documents | ../docs/01_SRS.md, ../docs/adr/ADR-014-Runtime-Reliability-and-Network-Security.md |

---

# Purpose

Define Phase 12 controls for BuildSphere's own Kubernetes workloads. This
specification does not change Kubernetes or Helm assets generated for user
projects.

# Deployment availability

- Every application Deployment uses `RollingUpdate`.
- `maxUnavailable` defaults to `0`; `maxSurge` defaults to `1`.
- `minReadySeconds` defaults to `5` so a newly ready pod must remain ready
  before rollout progress continues.
- Every pod template can include one soft topology spread constraint using
  `kubernetes.io/hostname`, `maxSkew: 1`, and `ScheduleAnyway`.
- The topology selector must exactly equal the Deployment selector.
- Topology spreading is enabled by default and can be disabled only for a
  target environment that cannot support the selected topology key.

# Pod disruption budgets

- PDB rendering is disabled by default.
- Enabling it creates one `policy/v1` resource per application Deployment.
- `minAvailable` defaults to `1`.
- The PDB selector must exactly equal the target Deployment selector.
- The effective minimum replica count is `replicaCount` for fixed scaling and
  `availability.autoscaling.minReplicas` for autoscaling.
- Rendering must fail when the effective count is below two or when
  `minAvailable` is greater than or equal to the effective count.

# Horizontal autoscaling

- HPA rendering is disabled by default.
- Enabling it creates one `autoscaling/v2` resource per application Deployment.
- Minimum replicas default to `2`; maximum replicas default to `5`.
- CPU utilization defaults to `70%`; memory utilization defaults to `80%`.
- Both targets are based on the requests already required for every container.
- Scale-up has no stabilization delay and permits doubling or adding two pods
  per minute, whichever is larger.
- Scale-down defaults to a 300-second stabilization window and at most 25% per
  minute.
- Deployment `spec.replicas` must be absent while autoscaling is enabled.
- A functioning Kubernetes resource Metrics API is an operator prerequisite.

# Network policy

- NetworkPolicy rendering is disabled by default.
- Enabling it creates one `networking.k8s.io/v1` ingress-only policy per
  application Deployment.
- Destination selectors and same-namespace caller selectors include
  `app.kubernetes.io/name`, `app.kubernetes.io/instance`, and
  `app.kubernetes.io/component`.
- Every policy allows the same-release `chart-test` component.
- Frontend allows the configured ingress controller.
- API Gateway allows the configured ingress controller and Monitoring Service.
- Auth allows API Gateway, Project Service, and Monitoring Service.
- Project allows API Gateway, Deployment Service, and Monitoring Service.
- Pipeline allows API Gateway, Project Service, and Monitoring Service.
- Deployment allows API Gateway and Monitoring Service.
- Monitoring allows API Gateway.
- Logging allows API Gateway, Pipeline Service, and Monitoring Service.
- AI allows API Gateway, Project Service, and Monitoring Service.
- Analytics has no application caller in the current graph.
- Notification allows API Gateway, Project Service, Pipeline Service,
  Deployment Service, AI Service, and Monitoring Service.
- Every backend allows the configured metrics collector; Frontend does not.
- Ingress controller and metrics collector peers combine configurable namespace
  and pod selectors.
- Each policy allows only TCP traffic to the destination's service HTTP port.
- Policies contain no egress section, `ipBlock`, empty peer, or blanket
  same-namespace allowance.

# Safe defaults and ownership

- Default chart rendering emits no PDB, HPA, or NetworkPolicy and retains the
  Phase 10 resource count.
- The chart installs no Metrics API, ingress controller, metrics collector,
  service mesh, or CNI plugin.
- Runtime secrets, PostgreSQL, DNS, TLS, and external provider networking remain
  operator-owned.
- Enabling NetworkPolicy requires an enforcing network plugin and selectors
  matching the target environment.

# Verification

- `helm lint --strict` must pass.
- Structured checks validate default rollout and topology behavior.
- Opt-in renders validate all 11 PDBs, HPAs, and NetworkPolicies against their
  target selectors and service ports.
- Negative checks cover invalid autoscaling bounds, unsafe PDB combinations,
  invalid utilization targets, and invalid selector values.
- CI runs the Phase 12 verifier after Phase 10 and Phase 11 checks.
- The complete Phase 0-11 regression suite remains green.
- A disposable cluster may validate two-replica rollout, disruption budgets,
  policy installation, Helm tests, and upgrade. It must be deleted afterward.

# Non-goals

- Installing or managing cluster add-ons.
- Enforcing environment-specific egress controls.
- Mandatory multi-zone scheduling or anti-affinity.
- Load testing or selecting production autoscaling thresholds from traffic.
- Creating secrets, publishing images, or deploying to an external cluster.
- Database high availability, backup, restore, or secret rotation.
