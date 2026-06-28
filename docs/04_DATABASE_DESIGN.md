# Document Information

| Field | Value |
| --- | --- |
| Document | Database Design |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
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
| password_hash | text | Required for password login. |
| role | text | `user` or `admin`. |
| created_at | timestamptz | Required. |
| updated_at | timestamptz | Required. |

Indexes:

- Unique index on `email`.

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
| artifact_type | text | `archive`, `dockerfile`, `workflow`, `k8s_manifest`. |
| storage_uri | text | Location in local filesystem or object storage. |
| checksum | text | Optional. |
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
- provider_connections
- deployment_targets
- audit_logs
- cost_estimates
- template_versions

# Migration strategy

Use a migration tool selected during implementation. Options include Prisma Migrate, Drizzle Kit, or Knex migrations. The first implementation should create migrations from this document.
