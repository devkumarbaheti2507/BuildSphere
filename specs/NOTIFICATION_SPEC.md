# Document Information

| Field | Value |
| --- | --- |
| Document | Notification Spec |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
| Related Documents | ../docs/03_LLD.md |

---

# Purpose

Define notification behavior.

# MVP notification types

- project.created
- pipeline.generated
- pipeline.execution.started
- pipeline.execution.failed
- suggestion.created

# Notification fields

- id
- userId
- type
- title
- message
- metadata
- readAt
- createdAt

# Rules

- Notifications are user-scoped.
- Unread notifications appear first.
- Users can mark notifications as read.
