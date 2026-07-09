import { createHash } from "node:crypto";
import type {
  GeneratedFile,
  GitHubRepositorySummary,
  GitHubWorkflowRun,
  PipelineExecutionStatus,
} from "@buildsphere/shared-types";
import { ApiError } from "@buildsphere/service-core";
import type { GitHubApiClient } from "./github-api.js";
import type { GitHubOAuthService } from "./github-oauth.js";
import type {
  AuthRepository,
  GitHubConnectionRecord,
  ProjectGitHubRepositoryRecord,
} from "./repository.js";

const maxFiles = 100;
const maxFileBytes = 1024 * 1024;
const maxTotalBytes = 10 * 1024 * 1024;
const repositoryNamePattern = /^[A-Za-z0-9._-]+$/;
const workflowPathPrefix = ".github/workflows/";

const gitBlobSha = (content: string): string => {
  const bytes = Buffer.from(content, "utf8");
  return createHash("sha1")
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
};

export interface PublishProjectRepository {
  userId: string;
  projectId: string;
  name: string;
  description?: string;
  private: boolean;
  files: GeneratedFile[];
}

const publicRepository = ({
  userId: _userId,
  ...repository
}: ProjectGitHubRepositoryRecord): GitHubRepositorySummary => repository;

export class GitHubIntegrationService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly oauth: GitHubOAuthService,
    private readonly github: GitHubApiClient,
    private readonly now: () => number = Date.now,
  ) {}

  async publishRepository(
    input: PublishProjectRepository,
  ): Promise<GitHubRepositorySummary> {
    this.validateRepositoryName(input.name);
    const files = this.validateFiles(input.files);
    const accessToken = await this.accessToken(input.userId);
    let linked = await this.repository.findProjectGitHubRepository(
      input.projectId,
    );
    let createdRepository = false;
    if (linked && linked.userId !== input.userId) {
      throw new ApiError(
        404,
        "GITHUB_REPOSITORY_NOT_FOUND",
        "The project repository was not found",
      );
    }
    if (!linked) {
      const created = await this.github.createRepository(accessToken, {
        name: input.name,
        description: input.description,
        private: input.private,
      });
      linked = await this.repository.saveProjectGitHubRepository({
        projectId: input.projectId,
        userId: input.userId,
        githubRepositoryId: created.id,
        ownerLogin: created.ownerLogin,
        name: created.name,
        fullName: created.fullName,
        private: created.private,
        defaultBranch: created.defaultBranch,
        htmlUrl: created.htmlUrl,
        publishedFiles: 0,
      });
      createdRepository = true;
    }

    for (const file of files) {
      const sha = createdRepository
        ? undefined
        : await this.github.getContentSha(
            accessToken,
            linked.ownerLogin,
            linked.name,
            file.path,
          );
      if (sha === gitBlobSha(file.content)) continue;
      await this.github.putFile(
        accessToken,
        linked.ownerLogin,
        linked.name,
        file.path,
        file.content,
        sha,
      );
    }

    return publicRepository(
      await this.repository.saveProjectGitHubRepository({
        ...linked,
        publishedFiles: files.length,
        lastPublishedAt: new Date(this.now()).toISOString(),
      }),
    );
  }

  async getRepository(
    userId: string,
    projectId: string,
  ): Promise<GitHubRepositorySummary | undefined> {
    const linked = await this.repository.findProjectGitHubRepository(projectId);
    return linked?.userId === userId ? publicRepository(linked) : undefined;
  }

  async synchronizeWorkflowRuns(
    userId: string,
    projectId: string,
  ): Promise<GitHubWorkflowRun[]> {
    const linked = await this.requiredProjectRepository(userId, projectId);
    const accessToken = await this.accessToken(userId);
    const providerRuns = await this.github.listWorkflowRuns(
      accessToken,
      linked.ownerLogin,
      linked.name,
    );
    const runs: GitHubWorkflowRun[] = providerRuns.map((run) => ({
      githubRunId: run.id,
      projectId,
      name: run.name,
      status: normalizeWorkflowStatus(run.status, run.conclusion),
      conclusion: run.conclusion,
      branch: run.branch,
      headSha: run.headSha,
      runNumber: run.runNumber,
      event: run.event,
      htmlUrl: run.htmlUrl,
      startedAt: run.startedAt,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    }));
    await this.repository.upsertGitHubWorkflowRuns(runs);
    return this.repository.listGitHubWorkflowRuns(projectId);
  }

  async listWorkflowRuns(
    userId: string,
    projectId: string,
  ): Promise<GitHubWorkflowRun[]> {
    await this.requiredProjectRepository(userId, projectId);
    return this.repository.listGitHubWorkflowRuns(projectId);
  }

  private async requiredProjectRepository(
    userId: string,
    projectId: string,
  ): Promise<ProjectGitHubRepositoryRecord> {
    const linked = await this.repository.findProjectGitHubRepository(projectId);
    if (!linked || linked.userId !== userId) {
      throw new ApiError(
        409,
        "GITHUB_REPOSITORY_NOT_CONNECTED",
        "Publish the project to GitHub before synchronizing workflow runs",
      );
    }
    return linked;
  }

  private async accessToken(userId: string): Promise<string> {
    const connection =
      await this.repository.findGitHubConnectionByUserId(userId);
    if (!connection) {
      throw new ApiError(
        409,
        "GITHUB_CONNECTION_REQUIRED",
        "Connect a GitHub account before publishing this project",
      );
    }
    const active = await this.oauth.resolveAccessToken(connection);
    if (active.replacement) {
      await this.repository.saveGitHubConnection(
        replacementConnection(connection, active.replacement),
      );
    }
    return active.accessToken;
  }

  private validateRepositoryName(name: string): void {
    if (
      name.length < 1 ||
      name.length > 100 ||
      !repositoryNamePattern.test(name)
    ) {
      throw new ApiError(
        400,
        "INVALID_GITHUB_REPOSITORY_NAME",
        "The GitHub repository name is invalid",
      );
    }
  }

  private validateFiles(files: GeneratedFile[]): GeneratedFile[] {
    if (!files.length || files.length > maxFiles) {
      throw new ApiError(
        400,
        "INVALID_GITHUB_FILES",
        `Publish between 1 and ${maxFiles} generated files`,
      );
    }
    const paths = new Set<string>();
    let totalBytes = 0;
    for (const file of files) {
      const segments = file.path.split("/");
      const bytes = Buffer.byteLength(file.content, "utf8");
      if (
        !file.path ||
        file.path.length > 1024 ||
        file.path.startsWith("/") ||
        segments.some((segment) => !segment || segment === "." || segment === "..") ||
        paths.has(file.path) ||
        bytes > maxFileBytes
      ) {
        throw new ApiError(
          400,
          "INVALID_GITHUB_FILE_PATH",
          `Generated file cannot be published: ${file.path || "unnamed file"}`,
        );
      }
      paths.add(file.path);
      totalBytes += bytes;
    }
    if (totalBytes > maxTotalBytes) {
      throw new ApiError(
        400,
        "GITHUB_ARTIFACT_TOO_LARGE",
        "The generated artifact is too large to publish",
      );
    }
    return [...files].sort((left, right) => {
      const leftIsWorkflow = left.path.startsWith(workflowPathPrefix);
      const rightIsWorkflow = right.path.startsWith(workflowPathPrefix);
      if (leftIsWorkflow !== rightIsWorkflow) return leftIsWorkflow ? 1 : -1;
      return left.path.localeCompare(right.path);
    });
  }
}

const replacementConnection = (
  current: GitHubConnectionRecord,
  replacement: {
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string;
    accessTokenExpiresAt?: Date;
    refreshTokenExpiresAt?: Date;
  },
) => ({
  userId: current.userId,
  githubUserId: current.githubUserId,
  login: current.login,
  avatarUrl: current.avatarUrl,
  ...replacement,
});

export const normalizeWorkflowStatus = (
  status: string,
  conclusion?: string,
): PipelineExecutionStatus => {
  if (
    status === "queued" ||
    status === "requested" ||
    status === "waiting" ||
    status === "pending"
  ) {
    return "queued";
  }
  if (status !== "completed") return "running";
  if (conclusion === "success") return "succeeded";
  if (conclusion === "cancelled" || conclusion === "skipped") {
    return "cancelled";
  }
  return "failed";
};
