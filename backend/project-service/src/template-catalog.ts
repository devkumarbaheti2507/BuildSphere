import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  GeneratedFile,
  GenerationVariables,
  SupportedToolKey,
  TemplateMetadata,
  ToolSelection,
} from "@buildsphere/shared-types";
import { ApiError } from "@buildsphere/service-core";

interface CatalogEntry extends TemplateMetadata {
  requiredTools: SupportedToolKey[];
  sourcePath?: string;
  inlineContent?: string;
  language: string;
  explanation: string;
}

const catalog: CatalogEntry[] = [
  {
    key: "react-readme",
    category: "frontend",
    displayName: "React README",
    description: "Local setup instructions for the generated React frontend.",
    supportedVariables: ["projectName"],
    requiredTools: ["react"],
    outputPath: "frontend/README.md",
    sourcePath: "templates/react/README.template.md",
    language: "markdown",
    explanation:
      "Documents how another developer installs and starts the frontend.",
  },
  {
    key: "node-readme",
    category: "backend",
    displayName: "Node.js service README",
    description: "Local setup and health-check instructions for the backend.",
    supportedVariables: ["projectName", "containerPort"],
    requiredTools: ["nodejs"],
    outputPath: "backend/README.md",
    sourcePath: "templates/nodejs/README.template.md",
    language: "markdown",
    explanation:
      "Makes the generated backend understandable without reading its source first.",
  },
  {
    key: "node-dockerfile",
    category: "docker",
    displayName: "Node.js Dockerfile",
    description: "A two-stage Node.js container build.",
    supportedVariables: ["containerPort"],
    requiredTools: ["nodejs", "docker"],
    outputPath: "backend/Dockerfile",
    sourcePath: "templates/docker/Dockerfile.node.template",
    language: "dockerfile",
    explanation:
      "Packages the backend consistently and keeps build tooling out of the runtime stage.",
  },
  {
    key: "node-compose",
    category: "docker",
    displayName: "Node.js Compose stack",
    description: "Runs the service and PostgreSQL locally.",
    supportedVariables: [
      "serviceName",
      "containerPort",
      "dbName",
      "dbUser",
      "dbPassword",
    ],
    requiredTools: ["nodejs", "postgresql", "docker"],
    outputPath: "docker-compose.yml",
    sourcePath: "templates/docker/docker-compose.node-postgres.template.yml",
    language: "yaml",
    explanation:
      "Connects the application and its database in a repeatable local environment.",
  },
  {
    key: "github-actions-node",
    category: "github-actions",
    displayName: "GitHub Actions pipeline",
    description:
      "Validates generated files and builds available Node.js and Docker inputs.",
    supportedVariables: ["imageName"],
    requiredTools: ["github-actions"],
    outputPath: ".github/workflows/ci.yml",
    sourcePath: "templates/github-actions/node-docker-k8s.yml",
    language: "yaml",
    explanation:
      "Validates the generated artifact and runs available project quality checks automatically.",
  },
  ...[
    [
      "namespace",
      "namespace.yaml",
      "Defines an isolated Kubernetes namespace for the project.",
    ],
    [
      "deployment",
      "deployment.yaml",
      "Runs application replicas with health probes and resource limits.",
    ],
    [
      "service",
      "service.yaml",
      "Provides stable in-cluster networking for application pods.",
    ],
    [
      "ingress",
      "ingress.yaml",
      "Routes external HTTP traffic to the Kubernetes service.",
    ],
  ].map(([key, file, explanation]): CatalogEntry => ({
    key: `kubernetes-${key}`,
    category: "kubernetes",
    displayName: `Kubernetes ${key}`,
    description: explanation,
    supportedVariables: [
      "namespace",
      "serviceName",
      "replicas",
      "imageName",
      "imageTag",
      "containerPort",
      "host",
    ],
    requiredTools: ["kubernetes"],
    outputPath: `kubernetes/${file}`,
    sourcePath: `templates/kubernetes/${file}`,
    language: "yaml",
    explanation,
  })),
  {
    key: "helm-chart",
    category: "helm",
    displayName: "Helm chart metadata",
    description: "Defines the generated application chart and version.",
    supportedVariables: ["serviceName", "imageTag"],
    requiredTools: ["helm", "kubernetes"],
    outputPath: "helm/Chart.yaml",
    sourcePath: "templates/helm/Chart.yaml",
    language: "yaml",
    explanation:
      "Identifies the deployable chart and its application version to Helm.",
  },
  {
    key: "helm-values",
    category: "helm",
    displayName: "Helm default values",
    description: "Configurable defaults for the generated Kubernetes workload.",
    supportedVariables: [
      "replicas",
      "imageName",
      "imageTag",
      "containerPort",
      "host",
    ],
    requiredTools: ["helm", "kubernetes"],
    outputPath: "helm/values.yaml",
    sourcePath: "templates/helm/values.yaml",
    language: "yaml",
    explanation:
      "Keeps deployment settings configurable without editing chart templates.",
  },
  {
    key: "helm-helpers",
    category: "helm",
    displayName: "Helm template helpers",
    description: "Reusable resource names, selectors, and labels.",
    supportedVariables: ["serviceName"],
    requiredTools: ["helm", "kubernetes"],
    outputPath: "helm/templates/_helpers.tpl",
    sourcePath: "templates/helm/templates/_helpers.tpl",
    language: "gotemplate",
    explanation:
      "Centralizes stable Kubernetes naming and label conventions for the chart.",
  },
  {
    key: "helm-deployment",
    category: "helm",
    displayName: "Helm Deployment template",
    description: "A configurable application Deployment.",
    supportedVariables: ["serviceName"],
    requiredTools: ["helm", "kubernetes"],
    outputPath: "helm/templates/deployment.yaml",
    sourcePath: "templates/helm/templates/deployment.yaml",
    language: "yaml",
    explanation:
      "Renders application replicas with health probes and resource controls.",
  },
  {
    key: "helm-service",
    category: "helm",
    displayName: "Helm Service template",
    description: "A configurable in-cluster Service.",
    supportedVariables: ["serviceName"],
    requiredTools: ["helm", "kubernetes"],
    outputPath: "helm/templates/service.yaml",
    sourcePath: "templates/helm/templates/service.yaml",
    language: "yaml",
    explanation:
      "Provides stable networking for workloads installed from the chart.",
  },
  {
    key: "helm-ingress",
    category: "helm",
    displayName: "Helm Ingress template",
    description: "Optional configurable HTTP ingress routing.",
    supportedVariables: ["serviceName"],
    requiredTools: ["helm", "kubernetes"],
    outputPath: "helm/templates/ingress.yaml",
    sourcePath: "templates/helm/templates/ingress.yaml",
    language: "yaml",
    explanation:
      "Lets operators enable and customize external HTTP routing through values.",
  },
  {
    key: "helm-notes",
    category: "helm",
    displayName: "Helm installation notes",
    description: "Post-install commands and endpoint guidance.",
    supportedVariables: ["serviceName"],
    requiredTools: ["helm", "kubernetes"],
    outputPath: "helm/templates/NOTES.txt",
    sourcePath: "templates/helm/templates/NOTES.txt",
    language: "gotemplate",
    explanation: "Shows the operator how to reach the installed application.",
  },
  ...[
    {
      key: "versions",
      file: "versions.tf",
      displayName: "Terraform version constraints",
      description: "Pins compatible Terraform and AWS provider versions.",
      supportedVariables: [],
      language: "hcl",
      explanation:
        "Keeps Terraform and provider upgrades deliberate and reproducible.",
    },
    {
      key: "providers",
      file: "providers.tf",
      displayName: "Terraform AWS provider",
      description: "Configures the AWS region and common resource tags.",
      supportedVariables: [],
      language: "hcl",
      explanation:
        "Applies consistent ownership metadata without embedding credentials.",
    },
    {
      key: "variables",
      file: "variables.tf",
      displayName: "Terraform input variables",
      description: "Defines guarded EKS, network, access, and scaling inputs.",
      supportedVariables: ["serviceName", "awsRegion", "environment"],
      language: "hcl",
      explanation:
        "Makes cloud-sensitive settings explicit and keeps provisioning disabled by default.",
    },
    {
      key: "main",
      file: "main.tf",
      displayName: "Terraform AWS EKS module",
      description: "Defines the guarded VPC and managed EKS cluster modules.",
      supportedVariables: [],
      language: "hcl",
      explanation:
        "Provides reviewable AWS infrastructure source without running cloud operations.",
    },
    {
      key: "outputs",
      file: "outputs.tf",
      displayName: "Terraform outputs",
      description:
        "Exposes useful cluster and network values after provisioning.",
      supportedVariables: [],
      language: "hcl",
      explanation:
        "Documents the identifiers operators need after an approved Terraform apply.",
    },
    {
      key: "example-values",
      file: "terraform.tfvars.example",
      displayName: "Terraform example values",
      description: "Shows safe, non-secret project inputs.",
      supportedVariables: ["serviceName", "awsRegion", "environment"],
      language: "hcl",
      explanation:
        "Provides an inert starting point that requires deliberate operator changes.",
    },
    {
      key: "backend-example",
      file: "backend.tf.example",
      displayName: "Terraform backend example",
      description: "Documents optional remote state configuration.",
      supportedVariables: ["serviceName", "awsRegion"],
      language: "hcl",
      explanation:
        "Keeps state setup visible but inactive until an operator configures it.",
    },
    {
      key: "gitignore",
      file: ".gitignore",
      displayName: "Terraform ignore rules",
      description: "Excludes local state, plans, caches, and crash logs.",
      supportedVariables: [],
      language: "gitignore",
      explanation:
        "Prevents sensitive local Terraform artifacts from entering source control.",
    },
    {
      key: "readme",
      file: "README.md",
      sourceFile: "README.template.md",
      displayName: "Terraform operator guide",
      description:
        "Explains validation, review, state, access, and cost boundaries.",
      supportedVariables: ["serviceName", "awsRegion", "environment"],
      language: "markdown",
      explanation:
        "Guides an operator through safe validation before any approved cloud action.",
    },
  ].map(
    ({
      key,
      file,
      sourceFile,
      displayName,
      description,
      supportedVariables,
      language,
      explanation,
    }): CatalogEntry => ({
      key: `terraform-aws-eks-${key}`,
      category: "terraform",
      displayName,
      description,
      supportedVariables,
      requiredTools: ["terraform-aws-eks", "kubernetes"],
      outputPath: `terraform/${file}`,
      sourcePath: `templates/terraform/aws-eks-basic/${sourceFile ?? file}`,
      language,
      explanation,
    }),
  ),
  {
    key: "environment-example",
    category: "backend",
    displayName: "Environment variable example",
    description:
      "Documents required runtime configuration without containing real secrets.",
    supportedVariables: ["containerPort"],
    requiredTools: ["nodejs"],
    outputPath: ".env.example",
    language: "dotenv",
    inlineContent:
      "PORT={{containerPort}}\nDATABASE_URL=postgresql://user:password@localhost:5432/app\n",
    explanation:
      "Shows required configuration names while keeping real credentials out of source control.",
  },
];

export class TemplateCatalogService {
  constructor(private readonly repoRoot: string) {}

  list(): TemplateMetadata[] {
    return catalog.map(
      ({
        sourcePath: _sourcePath,
        inlineContent: _inline,
        language: _language,
        explanation: _explanation,
        requiredTools: _requiredTools,
        ...metadata
      }) => metadata,
    );
  }

  async render(
    variables: GenerationVariables,
    selections: readonly ToolSelection[],
  ): Promise<GeneratedFile[]> {
    const selectedTools = new Set(
      selections.map((selection) => selection.toolKey),
    );
    const selectedTemplates = catalog.filter((entry) =>
      entry.requiredTools.every((tool) => selectedTools.has(tool)),
    );
    return Promise.all(
      selectedTemplates.map(async (entry) => {
        const template =
          entry.inlineContent ??
          (await fs.readFile(
            path.join(this.repoRoot, entry.sourcePath!),
            "utf8",
          ));
        const missing = entry.supportedVariables.filter(
          (key) => variables[key as keyof GenerationVariables] === undefined,
        );
        if (missing.length) {
          throw new ApiError(
            400,
            "MISSING_TEMPLATE_VARIABLES",
            `Template ${entry.key} is missing variables`,
            { missing },
          );
        }
        const content = template.replace(
          /{{\s*([a-zA-Z][a-zA-Z0-9]*)\s*}}/g,
          (match, key: keyof GenerationVariables) => {
            const value = variables[key];
            if (value === undefined && entry.category === "helm") return match;
            if (value === undefined)
              throw new ApiError(
                400,
                "UNKNOWN_TEMPLATE_VARIABLE",
                `Unknown template variable ${key}`,
              );
            return String(value);
          },
        );
        return {
          path: entry.outputPath,
          content,
          language: entry.language,
          explanation: entry.explanation,
        };
      }),
    );
  }
}
