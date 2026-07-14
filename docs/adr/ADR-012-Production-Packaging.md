# ADR-012: Package BuildSphere with shared backend builds and Helm

Status: Accepted

Date: 2026-07-14

## Context

BuildSphere has ten TypeScript backend workspaces plus a Vite frontend. The
existing backend Dockerfiles install each service in isolation, but workspace
dependencies use `workspace:*`, so those stubs cannot produce valid standalone
images. The generated Phase 7 Helm chart belongs to user projects and cannot be
reused as BuildSphere's own release definition. Production packaging also must
not turn local development defaults into implicit production credentials or
cloud authority.

## Decision

Use one parameterized, repository-root backend Dockerfile for all backend
services. It performs a frozen PNPM workspace install, builds only the selected
service dependency graph, and uses `pnpm deploy --prod` to create a standalone
runtime tree. A fixed allowlist in the Dockerfile rejects unknown service
arguments. Runtime images run as the existing unprivileged Node user and set an
explicit asset root for templates, prompts, and migrations.

Build the frontend separately and serve static output with Nginx on an
unprivileged port. The compiled API base is `/api`, giving the browser one
origin in deployed environments.

Create a BuildSphere-owned Helm chart under `infrastructure/helm/buildsphere`.
The chart references an operator-created Secret and external PostgreSQL,
renders no credential resource, and runs the existing idempotent migration
runner as a Helm hook. Workloads receive consistent security contexts, probes,
resources, service accounts, and optional ingress/TLS. Kubernetes execution is
disabled by default and chart rendering fails when an operator enables it
without its host/environment policy.

CI validates and builds packaging but does not authenticate to a registry,
push images, create infrastructure, or deploy externally.

## Alternatives considered

- Keep one independently installed Dockerfile per service. Rejected because
  `workspace:*` dependencies require the monorepo and ten copies drift easily.
- Bundle all services into one process or image. Rejected because it removes
  independent service deployment and scaling boundaries.
- Bundle PostgreSQL and secrets in the production chart. Rejected because data
  lifecycle and credentials must remain explicit operator responsibilities.
- Reuse generated project Helm templates. Rejected because those templates
  model one generated workload, not the BuildSphere control plane.
- Let the frontend call an absolute API URL. Rejected because a same-origin
  path simplifies CORS, TLS, and environment promotion.
- Push images or install to a production cluster from CI. Rejected because
  Phase 10 establishes verifiable packaging, not release authority.

## Consequences

- Docker builds use the repository root as context and select a backend by
  build argument.
- Production images can be tagged and promoted independently while sharing one
  maintained build definition.
- Operators must provide image publication, PostgreSQL, a Secret, ingress
  controller, DNS, and TLS outside the chart.
- Phase 10 is staging-deployable but still requires later security,
  observability, reliability, and release-certification phases before public
  production use.
