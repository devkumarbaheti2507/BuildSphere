# Document Information

| Field | Value |
| --- | --- |
| Document | Auth Spec |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
| Related Documents | ../docs/10_SECURITY.md, ../docs/05_API_SPEC.md |

---

# Purpose

Define how authentication is implemented.

# MVP endpoints

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/logout`

# Validation

Registration requires:

- Name: 2 to 100 characters.
- Email: valid email format.
- Password: minimum 8 characters.

# Password handling

- Hash passwords before storage.
- Never return password hashes in API responses.
- Never log plaintext passwords.

# Tokens

Access token payload:

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "user"
}
```

# Acceptance criteria

- Duplicate email registration returns conflict error.
- Invalid login returns unauthorized error.
- Protected endpoint rejects missing token.
- `GET /auth/me` returns current user.
