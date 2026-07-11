# Document Information

| Field             | Value                           |
| ----------------- | ------------------------------- |
| Document          | UI and UX Design                |
| Version           | 0.1.0                           |
| Status            | Draft                           |
| Author            | BuildSphere Team                |
| Last Updated      | 2026-07-11                      |
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
Create project
Templates
Settings
```

Pipelines, GitHub integration, suggestions, generated files, and deployment
workflows are grouped as tabs within each project workspace.

# Pages

## Initial screen

The local MVP opens on login or signup so the first screen is the usable product entry point. A public marketing landing page remains future scope.

## Authentication pages

Pages:

- Sign up.
- Login.
- Forgot password placeholder for future.

Stored browser sessions are refreshed before protected page data loads. An
invalid refresh token clears local session state and returns the user to sign
in instead of leaving an authenticated shell with repeated unauthorized
requests.

## Dashboard

Shows:

- Total projects.
- Recent pipelines.
- Recent suggestions.
- Build success rate placeholder.
- Quick action: create project.
- Recent notifications with full messages and individual read actions.

## Notification center

The notification toolbar button opens a right-side modal drawer containing all
user-scoped notifications. Unread items are visually distinct. The drawer
shows complete messages, event type, timestamp, and read state, and includes
individual and mark-all-read commands. It closes with its close button, the
backdrop, or Escape and remains usable at mobile widths.

## Create project wizard

Steps:

1. Project basics.
2. Architecture selection.
3. Application stack.
4. Delivery stack.
5. Review and create.

The delivery step always includes GitHub Actions, Docker, and Kubernetes. Helm,
Terraform AWS EKS, and Prometheus are independently visible toggles; the
Terraform label makes its disabled-by-default cloud source boundary explicit.

## Project detail page

Tabs:

- Overview.
- Generated files.
- Pipeline and logs.
- GitHub repository and Actions.
- Suggestions.
- Deployment validation and targets.

The Deployment tab accepts a kubeconfig file for ephemeral inspection and
shows only a redacted context, API host, namespace, and authentication method.
Targets visibly distinguish `draft`, `inspected`, and `connected`. An inspected
target can build an offline preflight table that orders the latest artifact's
resources. When execution is configured, the user can explicitly retain the
credential, confirm and approve the exact artifact, deploy it, refresh safe
resource/rollout summaries, and separately approve a bounded rollback. Durable
operation history remains available after reload. Tables adapt or scroll within
their own boundaries on narrow screens instead of widening the page.

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
/templates
/settings
```

# Accessibility expectations

- Keyboard-accessible forms.
- Clear labels.
- Visible focus states.
- Sufficient text contrast.
- Error messages near inputs.
