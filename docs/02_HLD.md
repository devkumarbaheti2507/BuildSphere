# Document Information

| Field             | Value                                       |
| ----------------- | ------------------------------------------- |
| Document          | High Level Design                           |
| Version           | 0.1.0                                       |
| Status            | Draft                                       |
| Author            | BuildSphere Team                            |
| Last Updated      | 2026-07-14                                  |
| Related Documents | 01_SRS.md, 03_LLD.md, 04_DATABASE_DESIGN.md |

---

# Purpose

This document describes the high-level architecture of BuildSphere.

# Architecture style

BuildSphere uses a microservice-oriented architecture with a TypeScript-first implementation. During MVP development, services can run locally as independent Node.js services and communicate through REST APIs.

# System context

```text
User Browser
    |
    v
Frontend Web App
    |
    v
API Gateway
    |
    +--> Auth Service
    +--> Project Service
    +--> Pipeline Service
    +--> Deployment Service
    +--> AI Service
    +--> Logging Service
    +--> Monitoring Service
    +--> Notification Service
    +--> Analytics Service
```

# Main services

| Service              | Responsibility                                                              |
| -------------------- | --------------------------------------------------------------------------- |
| API Gateway          | Single entry point for frontend calls. Routes requests to backend services. |
| Auth Service         | User registration, login, tokens, authorization helpers.                    |
| Project Service      | Projects, tool selections, generated asset metadata.                        |
| Pipeline Service     | Pipeline definitions, stages, executions, statuses.                         |
| Deployment Service   | Deployment target definitions and generated deployment assets.              |
| Logging Service      | Log ingestion, storage, and streaming model.                                |
| Monitoring Service   | Health, metrics, and future Prometheus/Grafana integration.                 |
| AI Service           | Rule-based and LLM-assisted suggestions.                                    |
| Notification Service | User notifications and event messages.                                      |
| Analytics Service    | Product usage and engineering metrics.                                      |

# Generation boundary

Project Service owns selection-aware artifact generation through its template
catalog. Phase 7 adds Helm chart source as an optional packaging output when a
project also selects Kubernetes. Helm generation reuses the existing artifact
preview, archive, and GitHub publishing paths; it does not add a service or
grant cluster access.

Phase 8 adds an AWS EKS Terraform root module as optional infrastructure source
for Kubernetes projects. Project Service continues to render and store plain
files only. Terraform CLI validation can run locally or in generated CI, but
AWS credentials, state, plans, applies, and cloud API calls remain outside the
BuildSphere runtime boundary.

# External provider boundary

Phase 6 begins with a GitHub App. The browser starts the GitHub web application flow through Auth Service, GitHub redirects to the frontend callback, and Auth Service performs the code exchange and identity lookup. GitHub credentials and provider tokens never enter generated project files or frontend storage.

The GitHub App model is used instead of a classic OAuth App so later repository and Actions integrations can use fine-grained installation permissions and short-lived tokens.

Project Service owns the public project-scoped GitHub endpoints. It validates
project ownership and selects the generated artifact, then calls an
internal-token-protected Auth Service API. Auth Service alone decrypts or
refreshes GitHub user tokens, calls GitHub, and stores repository and workflow
run synchronization records. Provider tokens never cross the service boundary.

# Data stores

| Store          | Purpose                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| PostgreSQL     | Durable application data.                                                |
| Redis          | Cache, sessions, lightweight queues, live status.                        |
| Object storage | Generated artifacts and archives. MVP can use local filesystem or MinIO. |

# Communication model

MVP:

- Frontend communicates with API Gateway over HTTP/REST.
- API Gateway communicates with services over HTTP/REST.
- Services write to PostgreSQL and Redis.

Future:

- Event-driven communication with Kafka or NATS.
- WebSocket or Server-Sent Events for live logs.
- External provider integrations for GitHub, Jenkins, Kubernetes, and cloud APIs.

# Deployment model

Local development:

- Services run with `pnpm -r --parallel dev`.
- PostgreSQL, Redis, MinIO, and MailHog run through Docker Compose.

Phase 10 staging baseline:

- A shared monorepo-aware image definition builds independently tagged backend
  service images.
- A separate non-root web image serves the compiled frontend with a
  same-origin `/api` base path.
- Kubernetes handles orchestration through a BuildSphere-owned Helm chart.
- A Helm hook runs idempotent SQL migrations before install or upgrade.
- Runtime secrets and PostgreSQL are external inputs owned by the operator.
- Only the frontend and API Gateway are exposed through optional TLS ingress.

Future production hardening adds managed secret rotation, high availability,
autoscaling, network policy, backup/restore automation, Prometheus/Grafana,
centralized logs, traces, alerting, and release certification.

Phase 11 adds the first production observability boundary. Every backend
process owns an isolated Prometheus registry and exposes runtime plus HTTP RED
metrics on its internal service port. The Helm release advertises those
endpoints and can emit Prometheus Operator discovery and alert resources only
when an operator opts in. BuildSphere does not install or operate the
monitoring stack.

The generated Phase 7 chart is an inspectable deployment asset. Real Helm
install, upgrade, rollback, and Kubernetes credential handling remain outside
the generation boundary.

The Phase 10 chart is different: it packages BuildSphere itself. It does not
change the Phase 7 generated chart or grant BuildSphere cloud provisioning
authority. Its default deployment-execution setting remains disabled.

# Kubernetes execution boundary

BS-801 establishes a preflight-only boundary inside Deployment Service. The
service may parse a kubeconfig received in one authenticated request, but it
must discard the source text after producing a redacted connection summary.
Only that summary can be stored in `deployment_targets.config`.

Deployment Service can combine an inspected target with rendered Kubernetes
manifests to produce an explainable resource plan. That offline path does not
construct a Kubernetes API client, contact the selected server, run Helm, or
apply/delete resources. Retained credentials, approval policy, execution,
status observation, and rollback stay behind the separate BS-802/BS-803
boundary below.

BS-802 and BS-803 add an opt-in execution boundary inside Deployment Service.
Encrypted credentials, expiring approvals, and deployment operations are
stored in dedicated tables rather than target JSON. Artifact content remains
owned by Project Service and is loaded with the requesting user's
authorization before approval or execution. Deployment Service alone decrypts
the selected kubeconfig and constructs the official Kubernetes client.

The executor is disabled unless runtime configuration supplies a dedicated
encryption key, exact API-server host allowlist, and allowed environments.
Mutation is limited to an approved target namespace and a constrained resource
set. BuildSphere labels establish ownership, one active operation is allowed
per target, and operation history provides the audit boundary. Read-only status
observation and rollback reuse the same owner, credential, timeout, and host
controls. Rollback can restore a prior successful snapshot but cannot delete a
namespace or cluster-scoped resource.

# Major workflows

## Metrics and alerting flow

```text
Backend request -> Shared Service Core: count request and observe duration
Prometheus -> Internal Service /metrics: scrape process and HTTP metrics
Prometheus -> Monitoring Service /metrics: scrape aggregate health gauges
PrometheusRule -> Prometheus: evaluate availability, error, and latency rules
Alertmanager -> Operator: route alert according to external policy
Operator -> BuildSphere runbook: investigate and mitigate
Grafana -> Prometheus: query the versioned BuildSphere dashboard
```

Metrics stay pull-based and contain operational dimensions only. Public
ingress routes remain `/api` and `/`; metric endpoints are not added to the
external routing contract.

## Project generation flow

```text
User selects stack
    -> Frontend sends request to API Gateway
    -> Project Service stores project configuration
    -> Template catalog resolves only assets for selected tools
    -> Optional Helm selection adds a reusable Kubernetes chart
    -> Optional Terraform AWS EKS selection adds inert infrastructure source
    -> Pipeline Service creates pipeline definition
    -> Deployment Service creates deployment asset metadata
    -> AI Service generates initial recommendations
    -> User receives generated project summary
```

## Pipeline execution flow

```text
User triggers pipeline
    -> Pipeline Service creates execution record
    -> Logging Service stores stage logs
    -> Pipeline Service updates status
    -> Notification Service creates notification
    -> Frontend displays progress
```

# Design tradeoffs

## Why REST first

REST is easier to inspect, test, document, and implement in an MVP. Event-driven communication can be added after workflows are stable.

## Why TypeScript first

Using TypeScript across frontend and backend reduces context switching and improves Codex-assisted implementation consistency.

## Why template generation before real execution

Generating correct files is safer and easier to validate than immediately running deployments on external systems.
