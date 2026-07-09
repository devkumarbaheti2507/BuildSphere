# Next Session

Recommended next task:

Study and rehearse BuildSphere with the knowledge graph and presentation guide,
then select one post-Phase 6 candidate and define its requirements, backlog
ticket, and architecture boundary before implementation.

Immediate tasks:

1. Review Jenkins, Helm, Terraform, Kubernetes deployment, cost estimation, and collaboration candidates in `docs/12_ROADMAP.md`.
2. Choose one bounded milestone and add acceptance criteria to the SRS and backlog.
3. Create an ADR if the work introduces a provider, service, or deployment boundary.
4. Implement the smallest useful slice with focused tests.
5. Keep `pnpm verify` green throughout the work.

Current notes:

- The ChatGPT-ready learning pack is available in `docs/15_PROJECT_KNOWLEDGE_GRAPH.md`, `docs/project-knowledge-graph.json`, and `docs/16_PRESENTATION_AND_LEARNING_GUIDE.md`.
- BS-901 and BS-902 release verification completed on 2026-07-08.
- Frozen install, lint, production build, and all automated tests pass.
- Memory and PostgreSQL smoke workflows pass with 10 generated files, 7 pipeline stages, 14 logs, suggestions, 8 health checks, and 4 notifications.
- PostgreSQL migration and restart persistence checks pass.
- The complete desktop browser workflow and responsive desktop/mobile checks pass.
- PostgreSQL is running through the Docker Desktop `desktop-linux` context with its development volume retained.
- Node `v22.23.1` and `v24.18.0` are installed. The complete verification gate passes on both; run `nvm use` at the repository root to select the preferred Node 22 toolchain from `.nvmrc`.
- BS-501 GitHub App authentication completed on 2026-07-09.
- OAuth uses signed state, PKCE S256, verified GitHub emails, nullable local passwords, and AES-256-GCM encrypted provider tokens.
- The post-change memory-mode gateway smoke and disabled provider-discovery checks pass.
- BS-502 and BS-503 completed on 2026-07-09, completing the tracked Phase 6 GitHub milestone.
- Repository publishing validates owner/artifact boundaries, refreshes provider tokens, persists links before serial file writes, and safely retries partial failures.
- GitHub Actions synchronization persists normalized runs and displays them in the project GitHub workspace.
- The Node 22 gate passes with the new GitHub publishing regression tests, and the post-change memory-mode gateway smoke passes.
- Migrations 002 and 003, durable gateway regression, restart persistence, and `pnpm smoke:phase6:postgres` pass against PostgreSQL through Docker Desktop.
- Live GitHub OAuth, private repository creation, 10-file publication, successful Actions synchronization, and idempotent republishing passed on 2026-07-09.
- The disposable live repository and its initial failed runs remain available for inspection; corrected run 10 succeeded.
