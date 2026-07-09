# ADR-008: GitHub integration service boundary

Status: Accepted

Date: 2026-07-09

## Context

Repository publishing needs project ownership and generated artifacts, while
GitHub API calls need decrypted user tokens. Moving provider tokens into
Project Service would broaden the secret boundary; moving project data into
Auth Service would duplicate ownership rules.

## Decision

Project Service owns public project-scoped GitHub endpoints. It verifies the
authenticated project owner, selects the generated artifact, and calls Auth
Service with `INTERNAL_SERVICE_TOKEN`. Auth Service decrypts or refreshes the
GitHub token, performs provider calls, and persists project repository links
and synchronized workflow runs.

No endpoint returns a GitHub access or refresh token. Internal requests carry
only the BuildSphere user ID, project ID, repository options, and generated
files required for the operation.

## Consequences

- Project authorization stays in one service.
- Provider secrets remain in Auth Service.
- Auth Service stores logical project IDs without a database foreign key
  because Project Service owns project lifecycle.
- Internal provider APIs require service-token authentication and are not
  routed by API Gateway.
- A future dedicated Integration Service can replace this boundary without
  changing public project APIs.
