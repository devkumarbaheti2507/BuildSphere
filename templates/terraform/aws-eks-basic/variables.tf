variable "enable_cluster" {
  description = "Whether Terraform may create the VPC and EKS cluster."
  type        = bool
  default     = false
}

variable "aws_region" {
  description = "AWS region in which the cluster would be created."
  type        = string
  default     = "{{awsRegion}}"

  validation {
    condition     = length(trimspace(var.aws_region)) > 0
    error_message = "aws_region must not be empty."
  }
}

variable "cluster_name" {
  description = "Name of the EKS cluster and related resources."
  type        = string
  default     = "{{serviceName}}"

  validation {
    condition     = can(regex("^[0-9A-Za-z][0-9A-Za-z_-]{0,99}$", var.cluster_name))
    error_message = "cluster_name must be 1 to 100 alphanumeric, hyphen, or underscore characters and start with an alphanumeric character."
  }
}

variable "environment" {
  description = "Deployment environment used for resource tags."
  type        = string
  default     = "{{environment}}"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "environment must be development, staging, or production."
  }
}

variable "vpc_cidr" {
  description = "IPv4 CIDR block assigned to the generated VPC."
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "vpc_cidr must be a valid IPv4 CIDR block."
  }
}

variable "availability_zones" {
  description = "Optional AWS availability zones. Empty selects up to three available zones."
  type        = list(string)
  default     = []

  validation {
    condition     = length(var.availability_zones) == 0 || (length(var.availability_zones) >= 2 && length(var.availability_zones) <= 6)
    error_message = "availability_zones must be empty or contain between two and six zones."
  }
}

variable "kubernetes_version" {
  description = "Optional EKS Kubernetes minor version, for example 1.33."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.kubernetes_version == null || can(regex("^\\d+\\.\\d+$", var.kubernetes_version))
    error_message = "kubernetes_version must be null or a major.minor version."
  }
}

variable "node_instance_types" {
  description = "EC2 instance types used by the default managed node group."
  type        = list(string)
  default     = ["t3.medium"]

  validation {
    condition     = length(var.node_instance_types) > 0 && alltrue([for instance_type in var.node_instance_types : length(trimspace(instance_type)) > 0])
    error_message = "node_instance_types must contain at least one non-empty value."
  }
}

variable "node_min_size" {
  description = "Minimum managed node group size."
  type        = number
  default     = 1

  validation {
    condition     = var.node_min_size >= 1
    error_message = "node_min_size must be at least 1."
  }
}

variable "node_desired_size" {
  description = "Desired managed node group size."
  type        = number
  default     = 2

  validation {
    condition     = var.node_desired_size >= 1
    error_message = "node_desired_size must be at least 1."
  }
}

variable "node_max_size" {
  description = "Maximum managed node group size."
  type        = number
  default     = 3

  validation {
    condition     = var.node_max_size >= 1
    error_message = "node_max_size must be at least 1."
  }
}

variable "enable_nat_gateway" {
  description = "Whether private subnets route outbound traffic through one NAT gateway."
  type        = bool
  default     = true
}

variable "endpoint_public_access" {
  description = "Whether the EKS API endpoint is publicly reachable."
  type        = bool
  default     = false
}

variable "public_access_cidrs" {
  description = "Explicit CIDRs allowed to reach a public EKS API endpoint."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for cidr in var.public_access_cidrs : can(cidrnetmask(cidr))])
    error_message = "Every public_access_cidrs value must be a valid IPv4 CIDR block."
  }
}

variable "cluster_admin_principal_arn" {
  description = "IAM role or user ARN granted cluster administrator access."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.cluster_admin_principal_arn == null || can(regex("^arn:(aws|aws-us-gov|aws-cn):iam::[0-9]{12}:(role|user)/.+$", var.cluster_admin_principal_arn))
    error_message = "cluster_admin_principal_arn must be null or a valid IAM role or user ARN."
  }
}

variable "deletion_protection" {
  description = "Whether EKS deletion protection is enabled."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags merged with BuildSphere ownership tags."
  type        = map(string)
  default     = {}
}
