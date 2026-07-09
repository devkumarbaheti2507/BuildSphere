# auth-service

Handles local registration, GitHub App login, BuildSphere sessions, and user
identity.

## Port

Default local port: `8081`

## Required endpoint

```http
GET /health
```

## Authentication endpoints

- `GET /auth/providers`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/github/authorize`
- `POST /auth/github/callback`

GitHub authentication is optional. It remains disabled unless
`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_OAUTH_STATE_SECRET`, and
`GITHUB_TOKEN_ENCRYPTION_KEY` are all set. The encryption key must be a
base64-encoded 32-byte value, and the state secret must contain at least 32
characters. The GitHub App needs read access to user email addresses,
Administration write, Contents write, Workflows write, and Actions read
permissions. Its installation must cover repositories created by BuildSphere,
and its callback URL must match `GITHUB_OAUTH_CALLBACK_URL`.

## Implementation guidance

Read the relevant spec before implementing this service.

- API Gateway: `docs/03_LLD.md`
- Auth Service: `specs/AUTH_SPEC.md`
- GitHub integration: `specs/GITHUB_INTEGRATION_SPEC.md`
- Project Service: `specs/PROJECT_SPEC.md`
- Pipeline Service: `specs/PIPELINE_SPEC.md`
- Deployment Service: `specs/DEPLOYMENT_SPEC.md`
- Logging Service: `specs/LOGGING_SPEC.md`
- AI Service: `specs/AI_SPEC.md`
- Notification Service: `specs/NOTIFICATION_SPEC.md`
