# Document Information

| Field | Value |
| --- | --- |
| Document | Database Design |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-07-09 |
| Related Documents | 01_SRS.md, 03_LLD.md, 05_API_SPEC.md |

---

# Purpose

This document defines BuildSphere data ownership and initial relational schema.

# Database choice

Use PostgreSQL for MVP durable data.

# Ownership rule

Each service should logically own its data. During MVP, one PostgreSQL database may contain all schemas, but tables should use service prefixes or dedicated schemas to preserve boundaries.

# Core tables

## users

Owned by Auth Service.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| name | text | Required. |
| email | text | Unique, required. |
| password_hash | text | Nullable for provider-only accounts; required for password login. |
| role | text | `user` or `admin`. |
| created_at | timestamptz | Required. |
| updated_at | timestamptz | Required. |

Indexes:

- Unique index on `email`.

## github_connections

Owned by Auth Service.

| Column | Type | Notes |
| --- | --- | --- |
| user_id | uuid | Primary key and reference to `users.id`. |
| github_user_id | text | Unique stable GitHub user identifier. |
| login | text | Current GitHub login name. |
| avatar_url | text | Optional GitHub avatar URL. |
| access_token_encrypted | text | AES-GCM encrypted GitHub user token. |
| refresh_token_encrypted | text | Optional encrypted refresh token. |
| access_token_expires_at | timestamptz | Optional token expiry. |
| refresh_token_expires_at | timestamptz | Optional refresh-token expiry. |
| created_at | timestamptz | Required. |
| updated_at | timestamptz | Required. |

Provider secrets are never stored in plaintext. A dedicated environment key encrypts GitHub tokens before repository writes.

## project_github_repositories

Owned by Auth Service because repository operations require provider tokens.

| Column | Type | Notes |
| --- | --- | --- |
| project_id | uuid | Primary key; logical Project Service reference. |
| user_id | uuid | Project owner and GitHub connection owner. |
| github_repository_id | bigint | Unique stable GitHub repository ID. |
| owner_login | text | GitHub repository owner login. |
| name | text | Repository name. |
| full_name | text | Unique `owner/name` value. |
| private | boolean | Repository visibility. |
| default_branch | text | GitHub default branch. |
| html_url | text | Browser URL. |
| published_files | integer | Files written by the latest successful publish. |
| last_published_at | timestamptz | Last successful artifact publish. |
| created_at | timestamptz | Required. |
| updated_at | timestamptz | Required. |

## github_workflow_runs

Owned by Auth Service.

| Column | Type | Notes |
| --- | --- | --- |
| github_run_id | bigint | Primary key from GitHub. |
| project_id | uuid | References `project_github_repositories.project_id`. |
| name | text | Workflow display name. |
| status | text | Stable BuildSphere run status. |
| conclusion | text | Optional GitHub conclusion. |
| branch | text | Optional head branch. |
| head_sha | text | Commit SHA. |
| run_number | integer | GitHub sequence number. |
| event | text | Trigger event. |
| html_url | text | Browser URL. |
| started_at | timestamptz | Optional start time. |
| created_at | timestamptz | GitHub creation time. |
| updated_at | timestamptz | GitHub update time. |

## projects

Owned by Project Service.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| owner_id | uuid | References `users.id`. |
| name | text | Required. |
| description | text | Optional. |
| architecture_type | text | `monolith` or `microservices`. |
| visibility | text | `private` or `public`. |
| status | text | `active` or `archived`. |
| created_at | timestamptz | Required. |
| updated_at | timestamptz | Required. |

## project_tool_selections

Owned by Project Service.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| project_id | uuid | References projects. |
| category | text | Example: `frontend`, `backend`, `ci`, `deployment`. |
| tool_key | text | Example: `react`, `nodejs`, `github-actions`. |
| config | jsonb | Tool-specific settings. |

## generated_artifacts

Owned by Project Service.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| project_id | uuid | References projects. |
| artifact_type | text | `bundle` in the current implementation. |
| files | jsonb | Generated paths, content, language, and explanations. |
| checksum | text | SHA-256 checksum of the serialized file bundle. |
| created_at | timestamptz | Required. |

## pipeline_definitions

Owned by Pipeline Service.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| project_id | uuid | Project reference. |
| name | text | Required. |
| provider | text | `github-actions`, `jenkins`, etc. |
| definition | jsonb | Stages and config. |
| created_at | timestamptz | Required. |

## pipeline_executions

Owned by Pipeline Service.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| pipeline_id | uuid | References pipeline_definitions. |
| status | text | queued, running, succeeded, failed, cancelled. |
| started_at | timestamptz | Optional. |
| finished_at | timestamptz | Optional. |
| trigger_type | text | manual, git_push, scheduled. |

## pipeline_logs

Owned by Logging Service.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| execution_id | uuid | Pipeline execution ID. |
| stage_key | text | Stage identifier. |
| level | text | info, warn, error. |
| message | text | Log line. |
| timestamp | timestamptz | Required. |

## suggestions

Owned by AI Service.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| project_id | uuid | Project reference. |
| category | text | docker, kubernetes, security, testing, architecture. |
| severity | text | low, medium, high, critical. |
| title | text | Required. |
| description | text | Required. |
| recommended_action | text | Required. |
| status | text | open, accepted, dismissed. |
| created_at | timestamptz | Required. |

## notifications

Owned by Notification Service.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| user_id | uuid | Recipient. |
| type | text | Notification type. |
| title | text | Required. |
| message | text | Required. |
| read_at | timestamptz | Nullable. |
| created_at | timestamptz | Required. |

# Future tables

- organizations
- teams
- environments
- audit_logs
- cost_estimates
- template_versions

`deployment_targets` is implemented in migration 001. Generated artifacts are
currently stored directly in PostgreSQL JSONB; the object-storage URI model is
future work.

# Migration strategy

The MVP uses ordered SQL migrations under `infrastructure/database/migrations/` and a small TypeScript runner in `packages/service-core/src/migrate.ts`.

Run migrations with:

```bash
pnpm db:migrate
```

The runner records applied filenames in `schema_migrations`, uses a PostgreSQL advisory lock to prevent concurrent migration runs, and wraps each unapplied file in a transaction.
