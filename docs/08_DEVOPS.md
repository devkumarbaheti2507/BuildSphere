# Document Information

| Field             | Value                    |
| ----------------- | ------------------------ |
| Document          | DevOps Plan              |
| Version           | 0.1.0                    |
| Status            | Draft                    |
| Author            | BuildSphere Team         |
| Last Updated      | 2026-07-10               |
| Related Documents | 02_HLD.md, 12_ROADMAP.md |

---

# Purpose

This document defines how BuildSphere itself is built, tested, containerized, and deployed.

# Local development

Use PNPM workspaces.

```bash
corepack enable
pnpm install
pnpm -r build
```

Start dependencies:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Start services:

```bash
pnpm -r --parallel dev
```

# CI/CD for BuildSphere

GitHub Actions workflow:

- Checkout code.
- Setup Node.
- Enable Corepack.
- Install dependencies.
- Build packages.
- Run tests.

Future workflow:

- Lint.
- Type check.
- Unit tests.
- Integration tests.
- Docker image build.
- Vulnerability scan.
- Push images.
- Deploy to staging Kubernetes.

# Docker strategy

Every backend service should have its own Dockerfile.

Minimum container requirements:

- Uses environment variables.
- Exposes service port.
- Has health endpoint.
- Avoids committed secrets.

# Kubernetes strategy

BuildSphere includes raw templates under `templates/kubernetes/` and optional
Helm chart source under `templates/helm/`. Optional AWS EKS infrastructure
source lives under `templates/terraform/aws-eks-basic/`.

Future BuildSphere deployment will use:

- Namespace.
- Deployment per service.
- Service per service.
- Ingress for API gateway and frontend.
- ConfigMaps for non-secret config.
- Secrets managed externally.

# Observability

MVP:

- Structured logs.
- Health endpoints.

Future:

- Prometheus metrics.
- Grafana dashboards.
- Centralized logs.
- Distributed tracing.

# Generated DevOps assets

BuildSphere will generate:

- Dockerfile.
- Docker Compose file.
- GitHub Actions workflow.
- Kubernetes deployment.
- Kubernetes service.
- Kubernetes ingress.
- Optional Helm chart metadata, values, workload templates, and install notes.
- Optional disabled AWS EKS Terraform root module with VPC, managed node group,
  access, output, example-value, state, and operator files.
- README instructions.

Generated charts are packaging assets only. BuildSphere does not run Helm
install, upgrade, rollback, or uninstall commands in Phase 7.

Generated Terraform is infrastructure source only. BuildSphere and generated
CI may run formatting, `terraform init -backend=false`, and static validation.
They do not run plan, apply, destroy, import, or state operations, do not own a
remote backend, and do not receive AWS credentials in Phase 8.

# Environments

| Environment | Purpose                     |
| ----------- | --------------------------- |
| local       | Developer machine.          |
| dev         | Shared development, future. |
| staging     | Pre-production, future.     |
| production  | Real users, future.         |
