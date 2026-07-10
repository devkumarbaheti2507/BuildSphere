# Next Session

Recommended next task:

Select one post-Phase 8 candidate and define its requirements, backlog ticket,
and architecture boundary before implementation. The current candidates are
Jenkins integration, real Kubernetes deployment, cost estimation, and team
collaboration.

Immediate tasks:

1. Review the post-Phase 8 candidates in `docs/12_ROADMAP.md`.
2. Choose one bounded milestone and add acceptance criteria to the SRS and backlog.
3. Create an ADR if the work introduces a provider, execution, security, or deployment boundary.
4. Implement the smallest useful slice with focused and cross-phase tests.
5. Keep `pnpm verify`, `pnpm verify:terraform`, and the PostgreSQL smoke baseline green.

Current notes:

- The ChatGPT-ready learning pack is available in
  `docs/15_PROJECT_KNOWLEDGE_GRAPH.md`,
  `docs/project-knowledge-graph.json`, and
  `docs/16_PRESENTATION_AND_LEARNING_GUIDE.md`.
- BS-901 and BS-902 release verification completed on 2026-07-08.
- BS-501 through BS-503 completed the live-validated GitHub milestone on
  2026-07-09: OAuth, private repository creation, 10-file publication,
  successful Actions synchronization, and idempotent republishing passed.
- BS-601 and Phase 7 completed on 2026-07-10 with selection-aware generation,
  an optional seven-file Helm chart, dependency validation, generated CI checks,
  and raw-manifest validation isolation.
- Official Helm v4.2.2 strict lint and template rendering pass. No chart was
  installed into a cluster.
- BS-701 and Phase 8 completed on 2026-07-10 with optional
  `infrastructure/terraform-aws-eks`, a Kubernetes dependency, a nine-file
  disabled root module, wizard support, and safe generated CI checks.
- Official checksum-verified Terraform v1.15.8 passes format,
  backend-disabled initialization of VPC `6.6.1`, EKS `21.24.0`, and AWS
  provider `6.54.0`, plus static validation without AWS credentials.
- Frozen installation, zero-warning lint, every production build, and all 41
  automated tests pass. The PostgreSQL gateway smoke passes with 26 generated
  files, 7 stages, 14 logs, suggestions, 8 health checks, and notification read
  persistence.
- The notification experience is complete: full-history drawer, readable event
  content, individual and bulk read actions, synchronized dashboard/topbar
  counts, and passing desktop/mobile live-browser verification.
- Migrations 001-003, restart persistence, and
  `pnpm smoke:phase6:postgres` remain green.
- Node `v22.23.1` and `v24.18.0` are installed. Node 22 remains preferred via
  `.nvmrc`; the latest complete Phase 8 gate ran on Node 24.
- PostgreSQL and the local application are running through Docker Desktop with
  retained development data; the frontend is at `http://localhost:5173`.
- Terraform plan/apply/destroy, remote-state ownership, AWS API calls, real Helm
  operations, Kubernetes API access, secret management, and cloud cost approval
  remain out of scope.
