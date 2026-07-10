# Document Information

| Field             | Value            |
| ----------------- | ---------------- |
| Document          | Glossary         |
| Version           | 0.1.0            |
| Status            | Draft            |
| Author            | BuildSphere Team |
| Last Updated      | 2026-07-10       |
| Related Documents | All docs         |

---

# Purpose

This glossary defines terms used in BuildSphere.

# Terms

## Artifact

A generated or produced file, archive, image, or deployment asset.

## CI

Continuous Integration. The practice of frequently integrating code and automatically building and testing it.

## CD

Continuous Delivery or Continuous Deployment. The practice of preparing or automatically releasing software after successful validation.

## Container

A packaged runtime unit containing application code and dependencies.

## Dockerfile

A file that defines how to build a Docker image.

## Kubernetes

A container orchestration system that schedules and manages containers across nodes.

## Amazon EKS

Amazon Elastic Kubernetes Service, AWS's managed Kubernetes control-plane
service. BuildSphere generates Terraform source for it but does not provision
or operate a cluster.

## Infrastructure as Code

Version-controlled declarations of infrastructure configuration, commonly
abbreviated IaC.

## Terraform

An infrastructure-as-code tool used by BuildSphere as an optional generated
AWS EKS target. Phase 8 performs only formatting, backend-disabled
initialization, and static validation.

## Pipeline

A sequence of automated stages such as build, test, scan, package, and deploy.

## Pipeline stage

One step inside a pipeline.

## Template

A reusable file pattern used by BuildSphere to generate project assets.

## Tool selection

The user's chosen technology for a category such as backend, frontend, CI/CD, container, or deployment.

## AI suggestion

A recommendation produced by rules or an AI provider to improve project quality.

## Internal Developer Platform

A platform that standardizes and simplifies development workflows for engineering teams.

## Developer Experience

The quality, simplicity, and productivity of the tools and workflows used by developers.
