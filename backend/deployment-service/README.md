# deployment-service

Manages deployment targets, generated deployment assets, ephemeral kubeconfig
inspection, offline plans, explicit encrypted credential retention, approved
Kubernetes operations, rollout summaries, and bounded rollback.

## Port

Default local port: `8084`

## Required endpoint

```http
GET /health
```

## Phase 9 endpoints

- `GET /deployments/capabilities`
- `POST /deployments/kubernetes/inspect`
- `POST /deployments/targets`
- `GET /projects/:projectId/deployment-targets`
- `GET /deployments/targets/:targetId`
- `PUT /deployments/targets/:targetId/credential`
- `DELETE /deployments/targets/:targetId/credential`
- `POST /deployments/plans`
- `POST /deployments/validate`
- `POST /deployments/approvals`
- `POST /deployments/operations`
- `GET /projects/:projectId/deployment-operations`
- `GET /deployments/operations/:operationId`
- `POST /deployments/operations/:operationId/refresh`
- `POST /deployments/operations/:operationId/rollback-approval`
- `POST /deployments/operations/:operationId/rollback`

Inspection is request-scoped and persists only redacted connection metadata.
Credential retention is a separate explicit action: the selected context is
minimized, encrypted, owner/target bound, stored outside target JSON, never
returned, and revocable.

## Execution configuration

Execution remains disabled unless all required policy values are present:

```text
KUBERNETES_EXECUTION_ENABLED=true
KUBERNETES_CREDENTIAL_ENCRYPTION_KEY=<base64 encoded 32-byte key>
KUBERNETES_ALLOWED_SERVER_HOSTS=<exact host:port values>
KUBERNETES_ALLOWED_ENVIRONMENTS=development
KUBERNETES_APPROVAL_TTL_SECONDS=300
KUBERNETES_REQUEST_TIMEOUT_MS=10000
KUBERNETES_OPERATION_TIMEOUT_MS=60000
KUBERNETES_MAX_ATTEMPTS=3
```

Generate a local encryption key with `openssl rand -base64 32`. Never commit the
value. Production is not enabled by default. Execution accepts only owned,
immutable Project Service artifacts and constrained raw Kubernetes resources;
it does not run Helm or Terraform.

Use `npm run smoke:phase9:postgres` for durable provider-double verification.
For a separately approved disposable cluster, create the cluster, point
`KUBECONFIG_PATH` at its isolated-namespace kubeconfig, run
`npm run verify:phase9:kind`, revoke the credential, and delete the cluster.

## Implementation guidance

Read the relevant spec before implementing this service.

- API Gateway: `docs/03_LLD.md`
- Auth Service: `specs/AUTH_SPEC.md`
- Project Service: `specs/PROJECT_SPEC.md`
- Pipeline Service: `specs/PIPELINE_SPEC.md`
- Deployment Service: `specs/DEPLOYMENT_SPEC.md`
- Logging Service: `specs/LOGGING_SPEC.md`
- AI Service: `specs/AI_SPEC.md`
- Notification Service: `specs/NOTIFICATION_SPEC.md`
