# templates/terraform

Templates in this folder are rendered by the BuildSphere generation engine.

## AWS EKS basic

`aws-eks-basic/` generates a complete but disabled Terraform root module for an
AWS VPC and managed Amazon EKS cluster. The project service resolves only these
BuildSphere placeholders:

```text
{{serviceName}}
{{awsRegion}}
{{environment}}
```

Terraform expressions using `${...}` remain unchanged. Keep generated cloud
infrastructure disabled by default, pin reviewed module versions, and never add
credentials or active backend values to a template.
