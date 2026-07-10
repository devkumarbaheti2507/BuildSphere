import { createHash } from "node:crypto";
import type {
  CreateProjectInput,
  GeneratedArtifact,
  GenerationVariables,
  GitHubRepositorySummary,
  GitHubWorkflowRun,
  PublishGitHubRepositoryInput,
  ProjectSummary,
  ToolCategory,
  ToolSelection,
  UpdateProjectInput,
} from "@buildsphere/shared-types";
import { ApiError } from "@buildsphere/service-core";
import type { ProjectRepository } from "./repository.js";
import type { GitHubIntegrationGateway } from "./github-integration.js";
import { TemplateCatalogService } from "./template-catalog.js";

const supportedTools: Record<ToolCategory, string[]> = {
  frontend: ["react"],
  backend: ["nodejs"],
  database: ["postgresql"],
  cache: ["redis"],
  ci: ["github-actions"],
  container: ["docker"],
  deployment: ["kubernetes"],
  monitoring: ["prometheus"],
  packaging: ["helm"],
};

export class ProjectService {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly templates: TemplateCatalogService,
    private readonly github: GitHubIntegrationGateway,
  ) {}

  async create(
    ownerId: string,
    input: CreateProjectInput,
  ): Promise<ProjectSummary> {
    if (await this.repository.findByOwnerAndName(ownerId, input.name.trim())) {
      throw new ApiError(
        409,
        "PROJECT_NAME_CONFLICT",
        "You already have a project with this name",
      );
    }
    return this.repository.create({
      ...input,
      ownerId,
      name: input.name.trim(),
      description: input.description?.trim(),
    });
  }

  list(ownerId: string): Promise<ProjectSummary[]> {
    return this.repository.listByOwner(ownerId);
  }

  async getOwned(ownerId: string, projectId: string): Promise<ProjectSummary> {
    const project = await this.repository.findById(projectId);
    if (!project || project.ownerId !== ownerId) {
      throw new ApiError(404, "PROJECT_NOT_FOUND", "The project was not found");
    }
    return project;
  }

  async update(
    ownerId: string,
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectSummary> {
    const project = await this.getOwned(ownerId, projectId);
    if (input.name && input.name.toLowerCase() !== project.name.toLowerCase()) {
      if (
        await this.repository.findByOwnerAndName(ownerId, input.name.trim())
      ) {
        throw new ApiError(
          409,
          "PROJECT_NAME_CONFLICT",
          "You already have a project with this name",
        );
      }
    }
    return this.repository.update(projectId, {
      ...input,
      name: input.name?.trim(),
      description: input.description?.trim(),
    });
  }

  async saveTools(
    ownerId: string,
    projectId: string,
    selections: ToolSelection[],
  ): Promise<ProjectSummary> {
    await this.getOwned(ownerId, projectId);
    const categories = new Set<string>();
    for (const selection of selections) {
      if (categories.has(selection.category)) {
        throw new ApiError(
          400,
          "DUPLICATE_TOOL_CATEGORY",
          `Choose only one ${selection.category} tool`,
        );
      }
      categories.add(selection.category);
      if (!supportedTools[selection.category].includes(selection.toolKey)) {
        throw new ApiError(
          400,
          "UNSUPPORTED_TOOL",
          `${selection.toolKey} is not supported for ${selection.category}`,
        );
      }
    }
    const selectedTools = new Set(
      selections.map((selection) => selection.toolKey),
    );
    if (selectedTools.has("helm") && !selectedTools.has("kubernetes")) {
      throw new ApiError(
        400,
        "TOOL_DEPENDENCY_REQUIRED",
        "Helm packaging requires Kubernetes deployment",
        { toolKey: "helm", requiredToolKey: "kubernetes" },
      );
    }
    await this.repository.replaceToolSelections(projectId, selections);
    return this.getOwned(ownerId, projectId);
  }

  async generate(
    ownerId: string,
    projectId: string,
    overrides: Partial<GenerationVariables> = {},
  ): Promise<GeneratedArtifact> {
    const project = await this.getOwned(ownerId, projectId);
    if (project.status === "archived") {
      throw new ApiError(
        409,
        "PROJECT_ARCHIVED",
        "Archived projects cannot generate new artifacts",
      );
    }
    if (!project.toolSelections.length) {
      throw new ApiError(
        409,
        "TOOLS_NOT_SELECTED",
        "Select project tools before generating files",
      );
    }

    const slug =
      project.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "app";
    const variables: GenerationVariables = {
      projectName: project.name,
      serviceName: slug,
      containerPort: 8080,
      imageName: `${slug}-service`,
      imageTag: "latest",
      namespace: slug,
      replicas: 2,
      host: `${slug}.local`,
      dbName: slug.replace(/-/g, "_"),
      dbUser: "app_user",
      dbPassword: "replace_me",
      ...overrides,
    };
    const files = await this.templates.render(
      variables,
      project.toolSelections,
    );
    const checksum = createHash("sha256")
      .update(JSON.stringify(files))
      .digest("hex");
    return this.repository.createArtifact(projectId, files, checksum);
  }

  async listArtifacts(
    ownerId: string,
    projectId: string,
  ): Promise<GeneratedArtifact[]> {
    await this.getOwned(ownerId, projectId);
    return this.repository.listArtifacts(projectId);
  }

  async getArtifact(
    ownerId: string,
    artifactId: string,
  ): Promise<GeneratedArtifact> {
    const artifact = await this.repository.findArtifact(artifactId);
    if (!artifact)
      throw new ApiError(
        404,
        "ARTIFACT_NOT_FOUND",
        "The generated artifact was not found",
      );
    await this.getOwned(ownerId, artifact.projectId);
    return artifact;
  }

  async publishToGitHub(
    ownerId: string,
    projectId: string,
    input: PublishGitHubRepositoryInput,
  ): Promise<GitHubRepositorySummary> {
    const project = await this.getOwned(ownerId, projectId);
    const artifact = input.artifactId
      ? await this.getArtifact(ownerId, input.artifactId)
      : (await this.repository.listArtifacts(projectId))[0];
    if (!artifact || artifact.projectId !== projectId) {
      throw new ApiError(
        409,
        "GENERATED_ARTIFACT_REQUIRED",
        "Generate project files before publishing to GitHub",
      );
    }
    return this.github.publish({
      userId: ownerId,
      projectId,
      name: input.name,
      description: input.description ?? project.description,
      private: input.private,
      files: artifact.files,
    });
  }

  async githubRepository(
    ownerId: string,
    projectId: string,
  ): Promise<GitHubRepositorySummary | undefined> {
    await this.getOwned(ownerId, projectId);
    return this.github.repository(ownerId, projectId);
  }

  async synchronizeGitHubRuns(
    ownerId: string,
    projectId: string,
  ): Promise<GitHubWorkflowRun[]> {
    await this.getOwned(ownerId, projectId);
    return this.github.synchronizeRuns(ownerId, projectId);
  }

  async githubRuns(
    ownerId: string,
    projectId: string,
  ): Promise<GitHubWorkflowRun[]> {
    await this.getOwned(ownerId, projectId);
    return this.github.runs(ownerId, projectId);
  }
}
