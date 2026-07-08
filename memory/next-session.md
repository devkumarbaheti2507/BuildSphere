# Next Session

Recommended next task:

Finish MVP release verification tickets BS-901 and BS-902 before beginning Phase 6.

Immediate tasks:

1. Confirm `https://registry.npmjs.org` is reachable.
2. Run `./scripts/pnpm-workspace.sh install --frozen-lockfile=false` to install `pg` and refresh `pnpm-lock.yaml`.
3. Create `.env` from `.env.example` and replace both JWT secrets and `INTERNAL_SERVICE_TOKEN` with strong local values.
4. Start PostgreSQL with `docker compose -f docker-compose.dev.yml up -d`.
5. Run `pnpm db:migrate`, then `pnpm -r --parallel dev`.
6. Exercise signup, project creation, generation, simulated pipeline logs, suggestions, deployment validation, health, and notifications through the browser.
7. Capture desktop and mobile screenshots and correct any responsive UI defects.
8. Run `./scripts/verify-workspace.sh` and commit the refreshed lockfile.

Current notes:

- Node `v26.3.0` is active while `.nvmrc` requests Node 22; all current TypeScript builds and tests pass, but release verification should also use Node 22.
- The npm registry and Yarn registry timed out repeatedly on 2026-07-07, including outside the sandbox.
- `pnpm-lock.yaml` does not yet include `packages/service-core`, workspace links added to services, or the new `pg` dependency.
- Existing local modules were restored from the PNPM store and used to verify `pnpm -r build` and `pnpm -r test`.
- `npm run smoke` passed against all services in `STORAGE_DRIVER=memory` mode; memory mode is non-durable and does not replace PostgreSQL verification.
- The in-app browser was unavailable, so screenshot-based UI verification is still required.
- The frontend dev server was started successfully at `http://127.0.0.1:5173` during implementation.
