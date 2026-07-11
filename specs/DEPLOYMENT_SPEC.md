# Document Information

| Field             | Value                |
| ----------------- | -------------------- |
| Document          | Deployment Spec      |
| Version           | 0.1.0                |
| Status            | Draft                |
| Author            | BuildSphere Team     |
| Last Updated      | 2026-07-11           |
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
- Raw manifest validation applies only to rendered Kubernetes YAML and excludes
  Helm chart source templates.

# Optional Helm packaging

Phase 7 can package the same workload defaults as a Helm chart when both Helm
and Kubernetes are selected. Chart generation does not apply resources to a
cluster and does not require kubeconfig or cloud credentials.

# Optional Terraform infrastructure

Phase 8 can generate AWS EKS infrastructure source when Terraform AWS EKS and
Kubernetes are selected. The default configuration is disabled and BuildSphere
does not collect AWS credentials, configure active remote state, or execute
Terraform plan/apply.

# Future behavior

## Phase 9 BS-801 preflight behavior

- Accept kubeconfig text only over an authenticated request with a 1 MiB
  maximum.
- Parse kubeconfig with `@kubernetes/client-node`.
- Require a resolvable current context, referenced cluster, and valid HTTP(S)
  API server URL.
- Return and optionally persist only a redacted summary containing context,
  cluster, server host, namespace, credential mechanism, TLS verification,
  and context count.
- Discard tokens, passwords, certificates, keys, certificate-authority data,
  auth-provider details, and exec command arguments.
- Represent targets without an inspected kubeconfig as `draft` and inspected
  targets as `inspected`.
- Build plans only for inspected, owner-scoped targets and structurally valid
  rendered Kubernetes YAML.
- Parse every YAML document and return API version, kind, resource name,
  namespace, source path, scope, order, and intended `apply` action.
- Reject credential-bearing `Secret` data from preflight plans.
- Mark every BS-801 plan as `executable: false` and `clusterRequestMade: false`.

## Phase 9 BS-802 execution behavior

- Keep execution disabled until `KUBERNETES_EXECUTION_ENABLED`, a dedicated
  AES-256-GCM key, exact API-server `host:port` allowlist, and allowed target
  environment list are configured.
- Retain credentials only through a separate, explicit endpoint. Minimize the
  kubeconfig to its selected context, cluster, and user before encryption.
- Bind encrypted kubeconfig to the owner and target using authenticated
  additional data. Store ciphertext in `deployment_target_credentials`, never
  in `deployment_targets.config` or an API response.
- Require HTTPS, TLS verification, an allowlisted server, and embedded token,
  client-certificate, or basic authentication. Reject file references, proxy
  URLs, impersonation, exec plugins, auth providers, and missing credentials.
- Resolve execution input from an immutable artifact owned by the authenticated
  user. Do not accept arbitrary browser-supplied manifests for mutation.
- Permit only `Namespace`, `ConfigMap`, `ServiceAccount`, `Role`,
  `RoleBinding`, `Service`, `Deployment`, `StatefulSet`, `DaemonSet`, `Job`,
  `CronJob`, and `Ingress`. Reject all `Secret` and unknown resources.
- Require all namespaced resources to use the target namespace. A `Namespace`
  resource must name exactly that namespace; no other cluster-scoped resource
  is executable.
- Bind each exact manifest digest to an owner-scoped, five-minute, single-use
  approval. Bind the approval to the current credential fingerprint, then
  consume approval and create the operation atomically. Credential replacement
  after approval must fail closed.
- Require an idempotency key, return the same operation for exact retries, and
  reject key reuse for different input.
- Allow one active operation per target.
- Preflight every existing resource. Existing resources other than Namespace
  must carry matching BuildSphere owner, project, and target labels.
- Add ownership labels to new resources and update owned resources with
  server-side apply using field manager `buildsphere-deployment-service` and
  `force=false`.
- Retry only transient failures with a maximum of three attempts and enforce
  request and operation deadlines.
- Persist only safe error codes/messages, resource identities, attempts,
  action, and summarized results. Never persist Kubernetes response bodies.

## Phase 9 BS-803 observation and rollback behavior

- List deployment operations by owned project and load individual operations
  only for their owner.
- Refresh status through read-only requests for the resources in the immutable
  operation snapshot.
- Summarize resources as `present`, `progressing`, `ready`, `degraded`, or
  `missing`; do not return object specs, environment values, or Secret data.
- Require a separate five-minute, single-use rollback approval.
- Permit rollback only for a successful apply that has an earlier successful
  apply on the same target.
- Reapply the immediately prior snapshot using the normal ownership and apply
  controls.
- Delete resources present only in the newer snapshot after a read confirms
  matching BuildSphere ownership. Never delete `Namespace` or any
  cluster-scoped resource.
- Persist rollback operations and publish success/failure notifications through
  the existing notification service.
