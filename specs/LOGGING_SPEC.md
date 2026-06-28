# Document Information

| Field | Value |
| --- | --- |
| Document | Logging Spec |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
| Related Documents | ../docs/03_LLD.md |

---

# Purpose

Define application logging and pipeline log behavior.

# Service logs

Every service should write structured logs with:

- timestamp
- level
- service
- correlationId
- message
- metadata

# Pipeline logs

Pipeline logs are user-visible and attached to pipeline executions.

Log fields:

- executionId
- stageKey
- level
- message
- timestamp

# MVP storage

Store pipeline logs in PostgreSQL or an append-only local file while implementing the MVP.

# Future storage

- Loki
- OpenSearch
- Cloud logging provider
