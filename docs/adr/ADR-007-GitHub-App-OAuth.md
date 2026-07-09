# ADR-007: GitHub App OAuth

## Status

Accepted.

## Context

Phase 6 requires GitHub login before BuildSphere can create repositories or observe GitHub Actions runs. GitHub supports classic OAuth Apps and GitHub Apps. A classic OAuth App grants broad user-scoped access and uses long-lived tokens. GitHub recommends GitHub Apps for fine-grained repository access, installation-aware automation, and short-lived user tokens.

The frontend is a browser application, while provider credentials and durable storage belong to Auth Service. The flow must protect callback integrity without exposing the GitHub client secret or provider tokens to the browser.

## Decision

Use a GitHub App with the OAuth web application flow for user authentication.

- Frontend creates the PKCE verifier and sends only the `S256` challenge when requesting an authorization URL.
- Auth Service creates signed, expiring state that binds the challenge to the callback.
- Frontend receives the authorization code and returns it with state and the verifier to Auth Service.
- Auth Service performs the code exchange, resolves a verified email, creates or links the BuildSphere user, and returns the existing BuildSphere JWT session.
- GitHub access and refresh tokens are encrypted with AES-256-GCM before PostgreSQL storage.
- Provider-only BuildSphere users have a nullable password hash.

## Consequences

- Later repository and Actions work can build on fine-grained GitHub App permissions and stored provider connections.
- GitHub tokens and the client secret never enter frontend session storage.
- Local configuration requires a GitHub App, callback URL, state secret, and token-encryption key.
- A future multi-provider abstraction can generalize the connection table and OAuth service after a second provider creates real shared requirements.
- Live end-to-end verification requires user-supplied GitHub App credentials; automated tests use a provider client double.

## References

- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps
