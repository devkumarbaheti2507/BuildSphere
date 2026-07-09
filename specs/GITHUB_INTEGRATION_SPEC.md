# Document Information

| Field | Value |
| --- | --- |
| Document | GitHub Integration Spec |
| Version | 0.1.0 |
| Status | Accepted for Phase 6 |
| Author | BuildSphere Team |
| Last Updated | 2026-07-09 |
| Related Documents | AUTH_SPEC.md, ../docs/10_SECURITY.md, ../docs/adr/ADR-007-GitHub-App-OAuth.md |

---

# Purpose

Define Phase 6 GitHub authentication, repository publishing, and Actions run synchronization while preserving the existing BuildSphere JWT session model.

# Provider choice

Use a GitHub App user access token obtained through the OAuth web application flow. Do not use a classic OAuth App. The GitHub App must have read access to account email addresses, Administration write access for repository creation, write access to repository contents and workflows, and read access to Actions. Repository creation is performed on behalf of the authenticated user, and the app installation must cover repositories created through BuildSphere.

# Runtime configuration

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_OAUTH_CALLBACK_URL`
- `GITHUB_OAUTH_STATE_SECRET`
- `GITHUB_TOKEN_ENCRYPTION_KEY`
- `GITHUB_API_VERSION`

The provider is disabled unless every required secret and callback value is present. Disabled provider status is public; configuration values are never returned.

# Authorization flow

1. Frontend requests provider status.
2. Frontend generates a high-entropy PKCE verifier and its `S256` challenge.
3. Auth Service signs an expiring state payload containing a random nonce and the challenge.
4. Frontend stores the verifier in `sessionStorage` and redirects to GitHub.
5. GitHub redirects to `/auth/github/callback` with `code` and `state`.
6. Frontend sends the code, state, and verifier to Auth Service.
7. Auth Service verifies state signature and expiry, verifies the challenge derived from the verifier, and exchanges the code server-side.
8. Auth Service fetches the GitHub user and a verified email address.
9. Auth Service creates or links the identity, encrypts provider tokens, and returns a BuildSphere auth session.

# Account rules

- A stable GitHub user ID takes precedence over mutable login and email values.
- If the GitHub identity is already connected, use its BuildSphere user.
- Otherwise, link to an existing BuildSphere user only when GitHub reports the same email as verified.
- Otherwise, create a provider-only user with no password hash.
- Password login for a provider-only user returns the existing generic invalid-credentials response.
- A GitHub authorization without a verified email is rejected.

# Token rules

- The GitHub client secret remains server-side.
- GitHub access and refresh tokens are never returned to the frontend.
- Provider tokens are encrypted with AES-256-GCM using a dedicated environment key.
- Store token expiry timestamps when GitHub returns expiration values.
- BuildSphere access and refresh tokens remain independent from GitHub provider tokens.

# API behavior

- `GET /auth/providers`
- `POST /auth/github/authorize`
- `POST /auth/github/callback`

All errors use the standard BuildSphere error envelope. Provider rejection, invalid state, missing verified email, disabled configuration, and provider unavailability use distinct error codes.

# Acceptance criteria

- Password registration and login continue to pass unchanged.
- Provider-disabled behavior is deterministic.
- State tampering, expiry, and PKCE mismatch are rejected before code exchange.
- Mocked GitHub callback creates a provider-only user and standard BuildSphere session.
- A verified matching email links to an existing user instead of creating a duplicate.
- Stored provider tokens are encrypted and do not contain plaintext token values.
- PostgreSQL migration and memory repository behavior are verified.
- Frontend handles provider discovery, redirect, callback progress, failure, and success.

# Repository publishing

- Project Service owns public project-scoped endpoints and verifies project ownership.
- Auth Service exposes provider operations only through an internal-token-protected API.
- The latest generated artifact is used unless the caller chooses an owned artifact ID.
- Repository names use GitHub-safe characters and contain at most 100 characters.
- A project has at most one persisted GitHub repository link.
- Create the repository with the requested visibility and description on first publish.
- Persist the link immediately after creation so a partial file failure can be retried.
- Validate all paths before any content write. Reject empty paths, absolute paths, `.` or `..` segments, duplicate paths, more than 100 files, and files over 1 MiB.
- Read the existing file SHA when present and use it for updates.
- Skip an update when the existing Git blob SHA already matches the generated content.
- Write files serially because GitHub content updates can conflict when performed concurrently.
- Write files under `.github/workflows/` after all other generated files so a new repository does not run against a partial artifact.
- Repeated publish requests update the linked repository rather than creating another repository.

# Provider-token refresh

- Use the stored access token when it is valid for at least 60 more seconds.
- When it is near expiry, exchange the encrypted refresh token using the GitHub App client credentials.
- Reject the operation with `GITHUB_REAUTHORIZATION_REQUIRED` when no usable refresh token remains.
- Encrypt and persist both replacement tokens and expiry timestamps before using the new access token.

# GitHub Actions synchronization

- Synchronization requires an existing project repository link.
- Fetch up to the latest 50 repository workflow runs.
- Normalize `queued`, `in_progress`, and `completed` GitHub states into `queued`, `running`, `succeeded`, `failed`, or `cancelled` BuildSphere states.
- Persist GitHub run identity, workflow name, branch, commit SHA, run number, trigger, conclusion, timestamps, and browser URL.
- Upsert by GitHub run ID so repeated synchronization updates rather than duplicates.
- Return stored runs newest first.
- Do not download Actions log archives in Phase 6.

# Out of scope

- GitHub App installation-token generation.
- Organization SSO policy handling.
- Provider disconnect UI.
- Workflow dispatch, rerun, cancellation, and log archive download.
