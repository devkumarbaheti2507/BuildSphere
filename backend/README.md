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

Each service is a TypeScript + Express application with a `/health` endpoint, structured request logs, correlation IDs, normalized errors, and focused API tests. Durable service data is stored in PostgreSQL through the migration under `infrastructure/database/migrations/`.
