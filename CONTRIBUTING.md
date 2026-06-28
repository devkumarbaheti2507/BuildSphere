# Contributing to BuildSphere

BuildSphere uses a documentation-first workflow.

## Before writing code

Read:

1. `README.md`
2. `BUILDSPHERE_MANIFEST.md`
3. `AGENTS.md`
4. Relevant docs and specs

## Contribution workflow

1. Create or select a backlog item from `docs/13_BACKLOG.md`.
2. Confirm the requirement in `docs/01_SRS.md` or a spec file.
3. Implement a small slice.
4. Add tests.
5. Update documentation.
6. Open a pull request using `.github/PULL_REQUEST_TEMPLATE.md`.

## Commit style

Use conventional commits.

Examples:

```text
feat: add project creation endpoint
docs: expand pipeline service spec
test: add auth validation tests
```

## Code review checklist

- Does the change match the spec?
- Are errors handled?
- Are secrets avoided?
- Are tests included?
- Are docs updated?
