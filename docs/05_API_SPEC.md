# Document Information

| Field | Value |
| --- | --- |
| Document | API Specification |
| Version | 0.1.0 |
| Status | Draft |
| Author | BuildSphere Team |
| Last Updated | 2026-06-28 |
| Related Documents | 01_SRS.md, 03_LLD.md, specs/* |

---

# Purpose

This document defines BuildSphere API conventions and initial endpoints.

# API conventions

Base URL for local development:

```text
http://localhost:8080/api
```

All protected endpoints require:

```http
Authorization: Bearer <access_token>
```

All responses use JSON.

# Standard success response

```json
{
  "data": {},
  "meta": {}
}
```

# Standard error response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": {}
  }
}
```

# Auth endpoints

## POST /auth/register

Request:

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "StrongPassword123"
}
```

Response:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "name": "Ada Lovelace",
      "email": "ada@example.com"
    },
    "accessToken": "token",
    "refreshToken": "token"
  }
}
```

## POST /auth/login

Request:

```json
{
  "email": "ada@example.com",
  "password": "StrongPassword123"
}
```

## GET /auth/me

Returns the authenticated user.

## POST /auth/refresh

Rotates a valid refresh token and returns a new authenticated session.

## POST /auth/logout

Revokes the supplied refresh token.

# Project endpoints

## POST /projects

Creates a project.

Request:

```json
{
  "name": "Order Platform",
  "description": "Microservice sample project",
  "architectureType": "microservices",
  "visibility": "private"
}
```

## GET /projects

Lists authenticated user's projects.

## GET /projects/{projectId}

Returns project details.

## PATCH /projects/{projectId}

Updates project metadata.

## POST /projects/{projectId}/tool-selections

Saves selected tools.

## POST /projects/{projectId}/generate

Generates project assets from templates.

## GET /projects/{projectId}/artifacts

Lists generated artifact bundles.

## GET /artifacts/{artifactId}/download

Downloads generated files as a TAR archive.

# Pipeline endpoints

## POST /pipelines

Creates a pipeline definition.

## GET /projects/{projectId}/pipelines

Lists project pipelines.

## POST /pipelines/{pipelineId}/executions

Starts a pipeline execution record.

## GET /pipelines/{pipelineId}/executions

Lists pipeline executions.

## GET /executions/{executionId}/logs

Returns logs for an execution.

## GET /executions/{executionId}

Returns the current simulated execution and stage states.

## POST /executions/{executionId}/cancel

Cancels a queued or running simulated execution.

# Suggestion endpoints

## GET /projects/{projectId}/suggestions

Lists suggestions.

## POST /projects/{projectId}/suggestions/analyze

Runs rule-based or AI analysis.

## PATCH /suggestions/{suggestionId}

Updates suggestion status.

# Notification endpoints

## GET /notifications

Lists user notifications.

## PATCH /notifications/{notificationId}/read

Marks notification as read.

# Deployment endpoints

- `POST /deployments/targets` creates a Kubernetes deployment target definition.
- `GET /projects/{projectId}/deployment-targets` lists owned targets.
- `POST /deployments/validate` performs structural checks on generated Kubernetes YAML.

# Monitoring endpoints

- `GET /monitoring/health` aggregates BuildSphere service health for an authenticated user.
- `GET /metrics` on Monitoring Service exposes Prometheus-format service health gauges.

# Health endpoints

Each service exposes:

```http
GET /health
```

Response:

```json
{
  "service": "project-service",
  "status": "ok",
  "timestamp": "2026-06-28T00:00:00.000Z"
}
```
