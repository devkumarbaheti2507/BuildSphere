# Document Information

| Field             | Value             |
| ----------------- | ----------------- |
| Document          | Notification Spec |
| Version           | 0.1.0             |
| Status            | Draft             |
| Author            | BuildSphere Team  |
| Last Updated      | 2026-07-10        |
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

# Frontend interaction

- The application toolbar exposes the current unread count and opens the
  notification center without changing routes.
- The notification center lists the complete retained notification history,
  including title, full message, type, created time, and read state.
- An unread item has an explicit mark-read action.
- Mark-all-read invokes the existing idempotent read endpoint for each unread
  item and preserves successful updates if a later request fails.
- The dashboard recent list also exposes individual mark-read controls.
- Read actions update the toolbar count, dashboard count, recent list, and open
  notification center from shared frontend state.
