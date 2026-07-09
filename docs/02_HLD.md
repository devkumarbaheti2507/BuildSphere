# Document Information

| Field | Value |
| --- | --- |
| Document | High Level Design |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-07-09 |
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

| Service | Responsibility |
| --- | --- |
| API Gateway | Single entry point for frontend calls. Routes requests to backend services. |
| Auth Service | User registration, login, tokens, authorization helpers. |
| Project Service | Projects, tool selections, generated asset metadata. |
| Pipeline Service | Pipeline definitions, stages, executions, statuses. |
| Deployment Service | Deployment target definitions and generated deployment assets. |
| Logging Service | Log ingestion, storage, and streaming model. |
| Monitoring Service | Health, metrics, and future Prometheus/Grafana integration. |
| AI Service | Rule-based and LLM-assisted suggestions. |
| Notification Service | User notifications and event messages. |
| Analytics Service | Product usage and engineering metrics. |

# External provider boundary

Phase 6 begins with a GitHub App. The browser starts the GitHub web application flow through Auth Service, GitHub redirects to the frontend callback, and Auth Service performs the code exchange and identity lookup. GitHub credentials and provider tokens never enter generated project files or frontend storage.

The GitHub App model is used instead of a classic OAuth App so later repository and Actions integrations can use fine-grained installation permissions and short-lived tokens.

Project Service owns the public project-scoped GitHub endpoints. It validates
project ownership and selects the generated artifact, then calls an
internal-token-protected Auth Service API. Auth Service alone decrypts or
refreshes GitHub user tokens, calls GitHub, and stores repository and workflow
run synchronization records. Provider tokens never cross the service boundary.

# Data stores

| Store | Purpose |
| --- | --- |
| PostgreSQL | Durable application data. |
| Redis | Cache, sessions, lightweight queues, live status. |
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

Future production:

- Each service runs as a container.
- Kubernetes handles orchestration.
- Helm charts manage deployment.
- Prometheus and Grafana handle observability.

# Major workflows

## Project generation flow

```text
User selects stack
    -> Frontend sends request to API Gateway
    -> Project Service stores project configuration
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
