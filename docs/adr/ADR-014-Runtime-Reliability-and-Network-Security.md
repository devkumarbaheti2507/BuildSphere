# ADR-014: Use optional reliability resources and ingress-only network policy

Status: Accepted

Date: 2026-07-15

## Context

The Phase 10 chart runs every application as one replica and relies on
Kubernetes defaults for rollout scheduling. Phase 11 supplies the metrics
contract needed by an external monitoring stack, but BuildSphere still lacks
reviewed disruption, autoscaling, and network-isolation behavior. Making all of
those controls mandatory would break the supported single-node installation:
PodDisruptionBudgets need spare replicas, HPAs need a Metrics API, and
NetworkPolicies need an enforcing network plugin plus environment-specific
controller identities.

BuildSphere services also call external PostgreSQL, GitHub, DNS, and optionally
the Kubernetes API. Their addresses and network paths are owned by each target
environment, so a portable chart cannot express safe egress destinations yet.

## Decision

Apply an explicit zero-unavailable rolling-update strategy, readiness settling
period, and soft hostname topology spread constraint to every application
Deployment by default. Soft spreading preserves scheduling on one-node
clusters and improves distribution when multiple nodes exist.

Render PodDisruptionBudgets only when enabled. Validate that the fixed replica
count, or the HPA minimum when autoscaling is enabled, is at least two and
greater than `minAvailable`.

Render `autoscaling/v2` HPAs only when enabled. Target CPU and memory
utilization from the existing resource requests and apply a conservative
scale-down policy. Omit Deployment `spec.replicas` while HPA is enabled so one
controller owns scale. The operator owns installation and health of the
cluster Metrics API.

Render NetworkPolicies only when enabled. Policies select all eleven
application components and restrict ingress to the exact checked-in internal
caller graph, the Helm chart-test component, configurable ingress-controller
selectors for Frontend and API Gateway, and configurable metrics-collector
selectors for the ten backends. Restrict each rule to the destination's HTTP
port. Do not render egress restrictions, `ipBlock` peers, or an unrestricted
namespace peer in Phase 12.

Keep PDB, HPA, and NetworkPolicy resources disabled by default. Do not install
a Metrics API, ingress controller, Prometheus collector, service mesh, or
network plugin as chart dependencies.

## Alternatives considered

- Require two replicas and disruption budgets by default. Rejected because it
  increases local resource use and changes the established one-node baseline.
- Enable HPAs by default. Rejected because Kubernetes does not provide resource
  metrics without a separate Metrics API implementation.
- Add a blanket namespace-wide allow policy. Rejected because it would permit
  unrelated workloads in the namespace to reach every BuildSphere service.
- Restrict both ingress and egress immediately. Rejected because portable egress
  rules cannot safely identify external database, provider, DNS, and API-server
  destinations.
- Install cluster add-ons as chart dependencies. Rejected because application
  release ownership does not include cluster networking, ingress, or metrics
  infrastructure.

## Consequences

- Every release has deterministic rollout and scheduling behavior.
- Operators can independently opt into disruption protection, autoscaling, and
  ingress isolation after satisfying their prerequisites.
- Helm does not fight the HPA for desired replica count.
- The network contract is reviewable and tied to current service behavior.
- Environment owners must configure selectors that match their actual ingress
  and metrics workloads before enabling policies.
- Egress controls, multi-zone hard requirements, load-based tuning, and
  cluster-addon lifecycle remain later environment-certification work.
