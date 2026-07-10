# Document Information

| Field             | Value                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Document          | Terraform AWS EKS Generation Spec                                                                          |
| Version           | 0.1.0                                                                                                      |
| Status            | Accepted                                                                                                   |
| Author            | BuildSphere Team                                                                                           |
| Last Updated      | 2026-07-10                                                                                                 |
| Related Documents | PROJECT_SPEC.md, TEMPLATE_SPEC.md, DEPLOYMENT_SPEC.md, ../docs/adr/ADR-009-Terraform-AWS-EKS-Generation.md |

---

# Purpose

Define safe AWS EKS Terraform generation for Phase 8 without giving
BuildSphere cloud credentials or Terraform execution authority.

# Selection model

- Tool category: `infrastructure`.
- Tool key: `terraform-aws-eks`.
- Terraform AWS EKS requires `deployment/kubernetes`.
- Removing the selection removes all `terraform/` files from future artifacts.

# Generated root module

The artifact contains:

```text
terraform/
  versions.tf
  providers.tf
  variables.tf
  main.tf
  outputs.tf
  terraform.tfvars.example
  backend.tf.example
  .gitignore
  README.md
```

# Infrastructure model

- Terraform CLI compatibility is constrained to a supported 1.x range.
- The HashiCorp AWS provider is declared with an explicit source and bounded
  major-version range.
- VPC and EKS registry modules use exact reviewed versions.
- The VPC provides public and private subnets across configurable availability
  zones with a single optional NAT gateway.
- EKS uses managed node groups, standard cluster add-ons, explicit endpoint
  controls, deletion protection, and an optional administrator principal ARN.
- Provider default tags identify BuildSphere, Terraform, project, and
  environment ownership.

# Safe defaults

- `enable_cluster` defaults to `false`.
- Public endpoint access defaults to disabled.
- No access key, secret key, session token, kubeconfig, or provider token is
  generated.
- `backend.tf.example` is documentation and is not loaded by Terraform until an
  operator deliberately renames and configures it.
- `.terraform/`, private variable files, state files, plans, and crash files are
  ignored; the dependency lock file and non-secret example values are not
  ignored.
- Example values contain only non-secret placeholders.

# Rendering

BuildSphere resolves project/service name, AWS region, and environment values.
All normal Terraform interpolation expressions remain unchanged because they
use `${...}` rather than BuildSphere's `{{...}}` placeholder syntax.

# Validation and CI

- Project Service enforces the Terraform-to-Kubernetes dependency.
- Local verification runs `terraform fmt -check -recursive`,
  `terraform init -backend=false`, and `terraform validate` against generated
  files.
- Generated GitHub Actions performs the same safe checks when `terraform/`
  exists.
- Generated CI contains no plan, apply, destroy, AWS credential, or state
  mutation step.

# Non-goals

- Running Terraform plan, apply, destroy, import, or state commands.
- Collecting or storing AWS credentials.
- Creating or owning a remote state bucket or lock.
- Estimating or approving AWS cost.
- Managing drift or reconciling existing cloud resources.
- Supporting Azure, Google Cloud, or non-EKS Terraform targets in Phase 8.

# Acceptance criteria

- The wizard can opt a Kubernetes project into Terraform AWS EKS.
- Terraform without Kubernetes returns a structured dependency error.
- A selected project generates all nine files listed above.
- An unselected project generates no `terraform/` path.
- Defaults are inert and generated files contain no credentials.
- Terraform format and static validation pass without AWS credentials.
- Existing artifact, GitHub, pipeline, deployment, and persistence workflows
  continue to pass.
