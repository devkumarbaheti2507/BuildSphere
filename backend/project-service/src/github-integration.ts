import type {
  GeneratedFile,
  GitHubRepositorySummary,
  GitHubWorkflowRun,
} from "@buildsphere/shared-types";
import { ApiError } from "@buildsphere/service-core";

export interface PublishGitHubProject {
  userId: string;
  projectId: string;
  name: string;
  description?: string;
  private: boolean;
  files: GeneratedFile[];
}

export interface GitHubIntegrationGateway {
  publish(input: PublishGitHubProject): Promise<GitHubRepositorySummary>;
  repository(
    userId: string,
    projectId: string,
  ): Promise<GitHubRepositorySummary | undefined>;
  synchronizeRuns(
    userId: string,
    projectId: string,
  ): Promise<GitHubWorkflowRun[]>;
  runs(userId: string, projectId: string): Promise<GitHubWorkflowRun[]>;
}

export class UnavailableGitHubIntegrationGateway
  implements GitHubIntegrationGateway
{
  publish(_input: PublishGitHubProject): Promise<GitHubRepositorySummary> {
    return Promise.reject(this.error());
  }

  repository(
    _userId: string,
    _projectId: string,
  ): Promise<GitHubRepositorySummary | undefined> {
    return Promise.reject(this.error());
  }

  synchronizeRuns(
    _userId: string,
    _projectId: string,
  ): Promise<GitHubWorkflowRun[]> {
    return Promise.reject(this.error());
  }

  runs(_userId: string, _projectId: string): Promise<GitHubWorkflowRun[]> {
    return Promise.reject(this.error());
  }

  private error(): ApiError {
    return new ApiError(
      503,
      "GITHUB_INTEGRATION_UNAVAILABLE",
      "The GitHub integration is currently unavailable",
    );
  }
}

export class HttpGitHubIntegrationGateway
  implements GitHubIntegrationGateway
{
  constructor(
    private readonly authServiceUrl: string,
    private readonly internalToken: string,
  ) {}

  publish(input: PublishGitHubProject): Promise<GitHubRepositorySummary> {
    return this.request("/internal/github/repositories", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  repository(
    userId: string,
    projectId: string,
  ): Promise<GitHubRepositorySummary | undefined> {
    return this.request(
      `/internal/github/projects/${encodeURIComponent(projectId)}/repository?userId=${encodeURIComponent(userId)}`,
    );
  }

  synchronizeRuns(
    userId: string,
    projectId: string,
  ): Promise<GitHubWorkflowRun[]> {
    return this.request(
      `/internal/github/projects/${encodeURIComponent(projectId)}/actions/sync`,
      { method: "POST", body: JSON.stringify({ userId }) },
    );
  }

  runs(userId: string, projectId: string): Promise<GitHubWorkflowRun[]> {
    return this.request(
      `/internal/github/projects/${encodeURIComponent(projectId)}/actions/runs?userId=${encodeURIComponent(userId)}`,
    );
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.authServiceUrl}${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          "x-internal-service-token": this.internalToken,
          ...init.headers,
        },
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      throw new ApiError(
        502,
        "GITHUB_INTEGRATION_UNAVAILABLE",
        "The GitHub integration is currently unavailable",
      );
    }
    const payload = (await response.json().catch(() => undefined)) as
      | { data?: T; error?: { code?: string; message?: string } }
      | undefined;
    if (!response.ok) {
      throw new ApiError(
        response.status,
        payload?.error?.code ?? "GITHUB_INTEGRATION_FAILED",
        payload?.error?.message ?? "The GitHub integration failed",
      );
    }
    return payload?.data as T;
  }
}
