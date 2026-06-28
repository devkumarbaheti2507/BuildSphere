# Placeholder Terraform template for future AWS EKS support.
# Do not use for production without review.

terraform {
  required_version = ">= 1.6.0"
}

variable "cluster_name" {
  type = string
}

output "cluster_name" {
  value = var.cluster_name
}
