# {{serviceName}} AWS EKS infrastructure

This directory contains a generated Terraform root module for an AWS VPC and
managed Amazon EKS cluster in `{{awsRegion}}`. It is configuration source, not a
record of infrastructure that BuildSphere has created.

## Safety state

- `enable_cluster` defaults to `false`, so the VPC and EKS modules have no
  instances.
- The EKS public endpoint defaults to disabled.
- EKS deletion protection defaults to enabled.
- No AWS credentials, kubeconfig, active backend, state, or plan is generated.
- BuildSphere and the generated pipeline do not run plan, apply, or destroy.

## Files

- `versions.tf` constrains Terraform and the AWS provider.
- `providers.tf` selects the region and applies ownership tags.
- `variables.tf` defines validation and guarded cloud inputs.
- `main.tf` declares exact VPC and EKS module versions.
- `outputs.tf` exposes cluster and network information after provisioning.
- `terraform.tfvars.example` contains non-secret, disabled example values.
- `backend.tf.example` documents optional S3 state without activating it.
- `.gitignore` excludes local caches, state, plans, and crash logs.

## Validate safely

Install Terraform 1.10 or newer, then run checks that do not contact AWS:

```bash
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
```

Initialization downloads the pinned modules and compatible providers. It does
not initialize remote state because the backend example is inactive and the
command disables backend initialization.

## Before any cloud action

1. Review AWS cost, account quotas, networking, IAM, and the supported EKS
   Kubernetes versions for `{{awsRegion}}`.
2. Copy `terraform.tfvars.example` to an ignored or securely managed values file.
3. Set a reviewed `cluster_admin_principal_arn`; never use an access key as an
   input.
4. Decide whether private-only API access is reachable from the execution
   environment. If public access is approved, set narrow explicit CIDRs.
5. Create and secure remote state outside this module, then deliberately rename
   and configure `backend.tf.example`.
6. Have an authorized operator review the complete configuration and execution
   plan before changing `enable_cluster` to `true`.

The generated environment tag is `{{environment}}`. Keep `.terraform.lock.hcl`
under version control after initialization; never commit state, plans,
credentials, or private variable files.
