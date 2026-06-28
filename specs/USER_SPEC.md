# Document Information

| Field | Value |
| --- | --- |
| Document | User Spec |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
| Related Documents | AUTH_SPEC.md |

---

# Purpose

Define user profile behavior.

# User fields

- id
- name
- email
- role
- createdAt
- updatedAt

# MVP behavior

- User is created through Auth Service.
- User can retrieve own profile.
- Admin behavior is reserved for future versions.

# Rules

- Email must be unique.
- Email changes are future scope.
- Account deletion is future scope.
