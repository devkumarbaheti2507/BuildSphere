# Backend Services

BuildSphere backend is organized as independent services.

## Services

- api-gateway
- auth-service
- project-service
- pipeline-service
- deployment-service
- monitoring-service
- logging-service
- ai-service
- analytics-service
- notification-service

Each service begins as a small TypeScript + Express app with a `/health` endpoint.
Codex should implement business features according to `specs/` and `docs/03_LLD.md`.
