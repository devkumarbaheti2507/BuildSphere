# Changelog

All notable changes to BuildSphere will be documented in this file.

The project follows semantic versioning once the first implementation milestone is complete.

## [Unreleased]

### Added

- Enforceable TypeScript linting as part of workspace verification.
- Regression coverage for idempotent service shutdown.

### Fixed

- Prevent duplicate PostgreSQL pool closure during coordinated service shutdown.

### Verified

- Frozen dependency installation, PostgreSQL migrations, durable gateway workflows, restart persistence, and responsive browser workflows through Phase 5.

## [0.1.0] - 2026-06-28

### Added

- Initial repository scaffold.
- Product documentation.
- Architecture documentation.
- Codex guidance via `AGENTS.md`.
- Backend service skeletons.
- Frontend skeleton.
- Infrastructure and template folders.
