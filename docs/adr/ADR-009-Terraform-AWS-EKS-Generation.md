# ADR-009: Generate-only AWS EKS Terraform boundary

Status: Accepted

Date: 2026-07-10

## Context

Phase 8 introduces the first cloud-specific infrastructure output. BuildSphere
could hand-write every AWS resource, use maintained registry modules, or invoke
Terraform and AWS directly. A runtime cloud integration would require
credentials, state ownership, cost controls, approvals, and recovery behavior
that do not exist in the current Project Service boundary.

The repository already contains an AWS EKS placeholder and Kubernetes is the
implemented deployment target. AWS EKS is therefore the smallest coherent
first Terraform target, but selecting it must not imply that BuildSphere owns
the user's AWS account or Terraform state.

## Decision

Project Service will generate an AWS EKS Terraform root module as plain artifact
files. It will use explicitly versioned `terraform-aws-modules/vpc/aws` and
`terraform-aws-modules/eks/aws` registry modules instead of hand-writing their
resource graphs.

The generated module defaults `enable_cluster` to `false`, contains no AWS
credentials, and provides only an inactive remote-backend example. BuildSphere
and generated CI may run `terraform fmt`, `terraform init -backend=false`, and
`terraform validate`. They must not run `terraform plan`, `terraform apply`, or
`terraform destroy` in Phase 8.

The tool key is provider-specific: `infrastructure/terraform-aws-eks`. Future
Azure, Google Cloud, or reusable-module targets receive separate tool keys and
specifications rather than overloading an ambiguous `terraform` selection.

## Consequences

- Existing artifact preview, download, and GitHub publishing need no new
  service or database schema.
- Cloud credentials and state remain operator-owned and outside BuildSphere.
- Versioned community modules reduce infrastructure code volume but become
  external validation-time dependencies.
- Generated defaults are intentionally inert and require deliberate operator
  configuration before a plan can describe cloud resources.
- Real provisioning, cost approval, drift, state locking, import, and rollback
  require a future execution boundary and security review.
