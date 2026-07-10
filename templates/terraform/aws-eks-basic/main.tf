locals {
  common_tags = merge(
    {
      Environment = var.environment
      ManagedBy   = "Terraform"
      Project     = var.cluster_name
      Source      = "BuildSphere"
    },
    var.tags,
  )

  selected_availability_zones = !var.enable_cluster ? [] : (
    length(var.availability_zones) > 0 ? var.availability_zones :
    slice(
      data.aws_availability_zones.available[0].names,
      0,
      min(3, length(data.aws_availability_zones.available[0].names)),
    )
  )
}

data "aws_availability_zones" "available" {
  count = var.enable_cluster && length(var.availability_zones) == 0 ? 1 : 0

  state = "available"
}

resource "terraform_data" "configuration_guard" {
  input = var.enable_cluster

  lifecycle {
    precondition {
      condition     = !var.enable_cluster || var.cluster_admin_principal_arn != null
      error_message = "cluster_admin_principal_arn must be set before enable_cluster is true."
    }

    precondition {
      condition     = !var.enable_cluster || length(local.selected_availability_zones) >= 2
      error_message = "At least two available availability zones are required."
    }

    precondition {
      condition     = !var.enable_cluster || !var.endpoint_public_access || length(var.public_access_cidrs) > 0
      error_message = "public_access_cidrs must be set before public endpoint access is enabled."
    }

    precondition {
      condition     = !var.enable_cluster || (var.node_min_size <= var.node_desired_size && var.node_desired_size <= var.node_max_size)
      error_message = "Node sizes must satisfy min <= desired <= max."
    }
  }
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "6.6.1"

  count = var.enable_cluster ? 1 : 0

  name = "${var.cluster_name}-vpc"
  cidr = var.vpc_cidr

  azs = local.selected_availability_zones
  private_subnets = [
    for index, _az in local.selected_availability_zones :
    cidrsubnet(var.vpc_cidr, 4, index)
  ]
  public_subnets = [
    for index, _az in local.selected_availability_zones :
    cidrsubnet(var.vpc_cidr, 8, index + 240)
  ]

  enable_dns_hostnames = true
  enable_dns_support   = true
  enable_nat_gateway   = var.enable_nat_gateway
  single_nat_gateway   = true

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }
  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }

  tags = local.common_tags

  depends_on = [terraform_data.configuration_guard]
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "21.24.0"

  count = var.enable_cluster ? 1 : 0

  name               = var.cluster_name
  kubernetes_version = var.kubernetes_version

  endpoint_private_access      = true
  endpoint_public_access       = var.endpoint_public_access
  endpoint_public_access_cidrs = var.public_access_cidrs
  deletion_protection          = var.deletion_protection

  enable_cluster_creator_admin_permissions = false
  access_entries = var.cluster_admin_principal_arn == null ? {} : {
    administrator = {
      principal_arn = var.cluster_admin_principal_arn
      policy_associations = {
        cluster_admin = {
          policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
          access_scope = {
            type = "cluster"
          }
        }
      }
    }
  }

  addons = {
    coredns = {}
    eks-pod-identity-agent = {
      before_compute = true
    }
    kube-proxy = {}
    vpc-cni = {
      before_compute = true
    }
  }

  vpc_id     = module.vpc[0].vpc_id
  subnet_ids = module.vpc[0].private_subnets

  eks_managed_node_groups = {
    default = {
      ami_type       = "AL2023_x86_64_STANDARD"
      instance_types = var.node_instance_types
      min_size       = var.node_min_size
      desired_size   = var.node_desired_size
      max_size       = var.node_max_size
    }
  }

  tags = local.common_tags

  depends_on = [terraform_data.configuration_guard]
}
