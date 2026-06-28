# Architecture Summary

BuildSphere has these major components:

- Frontend web app.
- API Gateway.
- Auth Service.
- Project Service.
- Pipeline Service.
- Deployment Service.
- Logging Service.
- Monitoring Service.
- AI Service.
- Notification Service.
- Analytics Service.
- Shared types package.
- Template library.
- Infrastructure assets.

MVP communication:

- REST over HTTP.

MVP data:

- PostgreSQL for durable records.
- Redis for cache and ephemeral state.
- MinIO/local storage for generated artifacts.
