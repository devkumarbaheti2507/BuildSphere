# Document Information

| Field | Value |
| --- | --- |
| Document | UI and UX Design |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
| Related Documents | 00_PROJECT_VISION.md, 01_SRS.md |

---

# Purpose

This document defines the main BuildSphere user experience.

# UX principles

- Guide the user step by step.
- Explain DevOps decisions in plain language.
- Show generated files clearly.
- Avoid overwhelming beginners.
- Allow advanced users to inspect and customize outputs.

# Main navigation

```text
Dashboard
Projects
Templates
Pipelines
Suggestions
Learning Center
Settings
```

# Pages

## Initial screen

The local MVP opens on login or signup so the first screen is the usable product entry point. A public marketing landing page remains future scope.

## Authentication pages

Pages:

- Sign up.
- Login.
- Forgot password placeholder for future.

## Dashboard

Shows:

- Total projects.
- Recent pipelines.
- Recent suggestions.
- Build success rate placeholder.
- Quick action: create project.

## Create project wizard

Steps:

1. Project basics.
2. Architecture selection.
3. Frontend selection.
4. Backend selection.
5. Database and cache.
6. CI/CD provider.
7. Container and deployment target.
8. Review and generate.

## Project detail page

Tabs:

- Overview.
- Tool selections.
- Generated files.
- Pipelines.
- Suggestions.
- Logs.
- Settings.

## Pipeline page

Shows:

- Pipeline stages.
- Current status.
- Logs.
- Stage explanation panel.
- Retry or rerun action placeholder.

## Suggestions page

Shows:

- Suggestion cards.
- Severity.
- Category.
- Recommended action.
- Accept or dismiss.

## Learning mode panel

Appears beside pipeline stages and generated files.

Content format:

- What this is.
- Why it matters.
- Common mistakes.
- Best practice.

# Component list

- `AppShell`
- `Sidebar`
- `Topbar`
- `ProjectCard`
- `WizardStep`
- `ToolSelector`
- `PipelineTimeline`
- `LogViewer`
- `SuggestionCard`
- `GeneratedFileViewer`
- `LearningPanel`

# Initial frontend route map

```text
/ -> login when signed out, dashboard when signed in
/login
/signup
/dashboard
/projects
/projects/new
/projects/:projectId
/projects/:projectId/pipelines
/projects/:projectId/suggestions
/settings
```

# Accessibility expectations

- Keyboard-accessible forms.
- Clear labels.
- Visible focus states.
- Sufficient text contrast.
- Error messages near inputs.
