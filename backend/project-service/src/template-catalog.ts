import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  GeneratedFile,
  GenerationVariables,
  TemplateMetadata,
} from "@buildsphere/shared-types";
import { ApiError } from "@buildsphere/service-core";

interface CatalogEntry extends TemplateMetadata {
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
    outputPath: `kubernetes/${file}`,
    sourcePath: `templates/kubernetes/${file}`,
    language: "yaml",
    explanation,
  })),
  {
    key: "environment-example",
    category: "backend",
    displayName: "Environment variable example",
    description:
      "Documents required runtime configuration without containing real secrets.",
    supportedVariables: ["containerPort"],
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
        ...metadata
      }) => metadata,
    );
  }

  async render(variables: GenerationVariables): Promise<GeneratedFile[]> {
    return Promise.all(
      catalog.map(async (entry) => {
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
          (_match, key: keyof GenerationVariables) => {
            const value = variables[key];
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
