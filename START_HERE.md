# Start Here: BuildSphere

Use this file first when opening the project with Codex.

## What this repository is

BuildSphere is an AI-assisted Developer Experience Platform for designing, generating, deploying, observing, and improving microservice applications.

It is prepared as a documentation-first, Codex-friendly project scaffold.

## First reading order

Read these files in this exact order:

1. `README.md`
2. `BUILDSPHERE_MANIFEST.md`
3. `AGENTS.md`
4. `docs/00_PROJECT_VISION.md`
5. `docs/01_SRS.md`
6. `docs/02_HLD.md`
7. `docs/03_LLD.md`
8. `docs/12_ROADMAP.md`
9. `docs/13_BACKLOG.md`
10. `memory/next-session.md`

## First Codex prompt to use

```text
Read START_HERE.md, AGENTS.md, BUILDSPHERE_MANIFEST.md, docs/12_ROADMAP.md, docs/13_BACKLOG.md, and specs/AUTH_SPEC.md. Then inspect the workspace and implement the first roadmap task BS-001: make sure pnpm install, pnpm -r build, and pnpm -r test are ready to run cleanly. Keep changes small, explain the files changed, and update memory/completed-features.md and memory/next-session.md.
```

## First human verification checklist

Before coding, verify:

- Product name is correct: BuildSphere.
- Default stack is acceptable: React + TypeScript frontend, TypeScript backend services, PostgreSQL, Redis, Docker, GitHub Actions.
- MVP scope in `docs/01_SRS.md` matches your goal.
- Roadmap in `docs/12_ROADMAP.md` is practical.
- Backlog in `docs/13_BACKLOG.md` starts with workspace setup, then auth, then projects.

## Recommended first implementation sequence

1. Verify workspace configuration.
2. Implement shared types package.
3. Implement Auth Service.
4. Implement Project Service.
5. Implement API Gateway routing.
6. Implement frontend login/signup.
7. Implement project dashboard.
8. Implement project wizard.
9. Implement template catalog.
10. Implement project generation.

## Important rule

Do not let Codex jump directly into advanced features like Kubernetes deployment, cloud automation, or AI provider integration before the MVP foundation works.
