output "cluster_name" {
  description = "Name of the EKS cluster when enabled."
  value       = try(module.eks[0].cluster_name, null)
}

output "aws_region" {
  description = "AWS region configured for this root module."
  value       = var.aws_region
}

output "cluster_endpoint" {
  description = "Endpoint of the EKS Kubernetes API when enabled."
  value       = try(module.eks[0].cluster_endpoint, null)
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded EKS cluster certificate authority data when enabled."
  value       = try(module.eks[0].cluster_certificate_authority_data, null)
  sensitive   = true
}

output "vpc_id" {
  description = "ID of the generated VPC when enabled."
  value       = try(module.vpc[0].vpc_id, null)
}

output "private_subnet_ids" {
  description = "IDs of the generated private subnets when enabled."
  value       = try(module.vpc[0].private_subnets, [])
}

output "kubectl_config_command" {
  description = "AWS CLI command that configures kubectl after an approved apply."
  value       = var.enable_cluster ? "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks[0].cluster_name}" : null
}
