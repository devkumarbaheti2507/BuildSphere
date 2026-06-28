# AGENTS.md

This file is for Codex and other AI coding agents working on BuildSphere.

## Mission

Help implement BuildSphere according to the repository documentation. Do not guess product behavior when a specification exists. Prefer small, reviewable changes over large rewrites.

## Mandatory reading order

Before implementing any feature, read these files:

1. `BUILDSPHERE_MANIFEST.md`
2. `docs/00_PROJECT_VISION.md`
3. `docs/01_SRS.md`
4. `docs/02_HLD.md`
5. `docs/03_LLD.md`
6. `docs/12_ROADMAP.md`
7. Relevant file from `specs/`
8. `memory/project-context.md`
9. `memory/current-goals.md` if present, otherwise `memory/next-session.md`

## Document priority

If documents conflict, use this priority order:

1. User instruction in the current session.
2. `BUILDSPHERE_MANIFEST.md`.
3. `docs/01_SRS.md`.
4. `docs/02_HLD.md` and `docs/03_LLD.md`.
5. Files in `specs/`.
6. ADRs in `docs/adr/`.
7. Existing code.

When a conflict is discovered, update or create an ADR instead of silently changing direction.

## Coding rules

- Use TypeScript for frontend and backend MVP code.
- Keep services small and focused.
- Add `GET /health` to every backend service.
- Use environment variables for runtime configuration.
- Never hardcode secrets.
- Do not commit `.env` files.
- Keep generated templates under `templates/`.
- Keep infrastructure files under `infrastructure/`.
- Keep AI prompts under `prompts/`; do not hardcode long prompts in service code.
- Prefer explicit names over clever abstractions.

## How to implement a feature

1. Identify the roadmap milestone and backlog ticket.
2. Read the matching spec in `specs/`.
3. Implement the smallest useful slice.
4. Add or update tests.
5. Update docs if behavior changed.
6. Update `memory/completed-features.md`.
7. Update `memory/next-session.md` with remaining work.

## Recommended commands

```bash
corepack enable
pnpm install
pnpm -r build
pnpm -r test
```

For local infrastructure:

```bash
docker compose -f docker-compose.dev.yml up -d
```

## Output expectations

When completing a task, summarize:

- Files changed.
- Behavior implemented.
- Tests added or skipped.
- Known limitations.
- Next recommended step.

## Do not do these things

- Do not delete documentation because it seems outdated; update it.
- Do not introduce a new framework without an ADR.
- Do not add cloud-specific code to the MVP unless the roadmap asks for it.
- Do not build a full CI/CD runner in the MVP. The MVP generates and tracks pipeline definitions first.
- Do not make real external deployments without explicit approval and configuration.
