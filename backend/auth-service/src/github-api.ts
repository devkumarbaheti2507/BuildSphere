import { ApiError } from "@buildsphere/service-core";

const githubApiUrl = "https://api.github.com";

export interface CreateGitHubRepository {
  name: string;
  description?: string;
  private: boolean;
}

export interface GitHubApiRepository {
  id: string;
  ownerLogin: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
}

export interface GitHubApiWorkflowRun {
  id: string;
  name: string;
  status: string;
  conclusion?: string;
  branch?: string;
  headSha: string;
  runNumber: number;
  event: string;
  htmlUrl: string;
  startedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubApiClient {
  createRepository(
    accessToken: string,
    input: CreateGitHubRepository,
  ): Promise<GitHubApiRepository>;
  getContentSha(
    accessToken: string,
    owner: string,
    repository: string,
    path: string,
  ): Promise<string | undefined>;
  putFile(
    accessToken: string,
    owner: string,
    repository: string,
    path: string,
    content: string,
    sha?: string,
  ): Promise<void>;
  listWorkflowRuns(
    accessToken: string,
    owner: string,
    repository: string,
  ): Promise<GitHubApiWorkflowRun[]>;
}

export class HttpGitHubApiClient implements GitHubApiClient {
  constructor(private readonly apiVersion: string) {}

  async createRepository(
    accessToken: string,
    input: CreateGitHubRepository,
  ): Promise<GitHubApiRepository> {
    const response = await this.request(accessToken, "/user/repos", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        private: input.private,
        auto_init: false,
      }),
    });
    const payload = (await response.json().catch(() => undefined)) as
      | {
          id?: number | string;
          name?: string;
          full_name?: string;
          private?: boolean;
          default_branch?: string;
          html_url?: string;
          owner?: { login?: string };
        }
      | undefined;
    if (
      payload?.id === undefined ||
      !payload.name ||
      !payload.full_name ||
      typeof payload.private !== "boolean" ||
      !payload.default_branch ||
      !payload.html_url ||
      !payload.owner?.login
    ) {
      throw new ApiError(
        502,
        "GITHUB_REPOSITORY_RESPONSE_INVALID",
        "GitHub returned an invalid repository response",
      );
    }
    return {
      id: String(payload.id),
      ownerLogin: payload.owner.login,
      name: payload.name,
      fullName: payload.full_name,
      private: payload.private,
      defaultBranch: payload.default_branch,
      htmlUrl: payload.html_url,
    };
  }

  async getContentSha(
    accessToken: string,
    owner: string,
    repository: string,
    path: string,
  ): Promise<string | undefined> {
    const response = await this.request(
      accessToken,
      this.contentPath(owner, repository, path),
      {},
      true,
    );
    if (response.status === 404) return undefined;
    const payload = (await response.json().catch(() => undefined)) as
      | { sha?: string }
      | undefined;
    if (!payload?.sha) {
      throw new ApiError(
        502,
        "GITHUB_CONTENT_RESPONSE_INVALID",
        "GitHub returned invalid file metadata",
      );
    }
    return payload.sha;
  }

  async putFile(
    accessToken: string,
    owner: string,
    repository: string,
    path: string,
    content: string,
    sha?: string,
  ): Promise<void> {
    await this.request(
      accessToken,
      this.contentPath(owner, repository, path),
      {
        method: "PUT",
        body: JSON.stringify({
          message: `BuildSphere: publish ${path}`,
          content: Buffer.from(content, "utf8").toString("base64"),
          ...(sha ? { sha } : {}),
        }),
      },
    );
  }

  async listWorkflowRuns(
    accessToken: string,
    owner: string,
    repository: string,
  ): Promise<GitHubApiWorkflowRun[]> {
    const response = await this.request(
      accessToken,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/actions/runs?per_page=50`,
    );
    const payload = (await response.json().catch(() => undefined)) as
      | {
          workflow_runs?: Array<{
            id?: number | string;
            name?: string | null;
            status?: string;
            conclusion?: string | null;
            head_branch?: string | null;
            head_sha?: string;
            run_number?: number;
            event?: string;
            html_url?: string;
            run_started_at?: string | null;
            created_at?: string;
            updated_at?: string;
          }>;
        }
      | undefined;
    if (!Array.isArray(payload?.workflow_runs)) {
      throw new ApiError(
        502,
        "GITHUB_ACTIONS_RESPONSE_INVALID",
        "GitHub returned an invalid workflow-run response",
      );
    }
    return payload.workflow_runs.map((run) => {
      if (
        run.id === undefined ||
        !run.status ||
        !run.head_sha ||
        typeof run.run_number !== "number" ||
        !run.event ||
        !run.html_url ||
        !run.created_at ||
        !run.updated_at
      ) {
        throw new ApiError(
          502,
          "GITHUB_ACTIONS_RESPONSE_INVALID",
          "GitHub returned an invalid workflow run",
        );
      }
      return {
        id: String(run.id),
        name: run.name?.trim() || `Workflow run ${run.run_number}`,
        status: run.status,
        conclusion: run.conclusion ?? undefined,
        branch: run.head_branch ?? undefined,
        headSha: run.head_sha,
        runNumber: run.run_number,
        event: run.event,
        htmlUrl: run.html_url,
        startedAt: run.run_started_at ?? undefined,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
      };
    });
  }

  private contentPath(owner: string, repository: string, path: string): string {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${encodedPath}`;
  }

  private async request(
    accessToken: string,
    path: string,
    init: RequestInit = {},
    allowNotFound = false,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`${githubApiUrl}${path}`, {
        ...init,
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          "user-agent": "BuildSphere",
          "x-github-api-version": this.apiVersion,
          ...init.headers,
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ApiError(
        502,
        "GITHUB_UNAVAILABLE",
        "GitHub is currently unavailable",
      );
    }
    if (response.ok || (allowNotFound && response.status === 404)) {
      return response;
    }
    if (response.status === 401) {
      throw new ApiError(
        401,
        "GITHUB_REAUTHORIZATION_REQUIRED",
        "Reconnect GitHub to continue",
      );
    }
    if (response.status === 403) {
      throw new ApiError(
        403,
        "GITHUB_PERMISSION_DENIED",
        "The GitHub App does not have permission for this operation",
      );
    }
    if (response.status === 422) {
      throw new ApiError(
        409,
        "GITHUB_REPOSITORY_CONFLICT",
        "GitHub could not create or update the repository",
      );
    }
    throw new ApiError(
      502,
      "GITHUB_PROVIDER_ERROR",
      "GitHub could not complete the operation",
    );
  }
}
