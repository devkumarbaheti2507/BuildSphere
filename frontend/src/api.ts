import type {
  AuthProviderAvailability,
  AuthSession,
  CreateProjectInput,
  DeploymentTarget,
  GeneratedArtifact,
  GitHubAuthorization,
  GitHubRepositorySummary,
  GitHubWorkflowRun,
  ManifestValidationResult,
  Notification,
  PipelineDefinition,
  PipelineExecutionSummary,
  PipelineLog,
  PlatformHealth,
  ProjectSummary,
  Suggestion,
  SuggestionStatus,
  TemplateMetadata,
  ToolSelection,
  UserSummary,
} from "@buildsphere/shared-types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const request = async <T>(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<T> => {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type"))
    headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as
      { error?: { code?: string; message?: string } } | undefined;
    throw new ApiClientError(
      body?.error?.code ?? "REQUEST_FAILED",
      body?.error?.message ?? `Request failed with ${response.status}`,
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return ((await response.json()) as { data: T }).data;
};

export const api = {
  authProviders: () =>
    request<AuthProviderAvailability>("/auth/providers"),
  githubAuthorization: (codeChallenge: string) =>
    request<GitHubAuthorization>("/auth/github/authorize", undefined, {
      method: "POST",
      body: JSON.stringify({ codeChallenge }),
    }),
  githubCallback: (input: {
    code: string;
    state: string;
    codeVerifier: string;
  }) =>
    request<AuthSession>("/auth/github/callback", undefined, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  register: (input: { name: string; email: string; password: string }) =>
    request<AuthSession>("/auth/register", undefined, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  login: (input: { email: string; password: string }) =>
    request<AuthSession>("/auth/login", undefined, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  logout: (refreshToken: string) =>
    request<void>("/auth/logout", undefined, {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
  me: (token: string) => request<UserSummary>("/auth/me", token),
  projects: (token: string) => request<ProjectSummary[]>("/projects", token),
  project: (token: string, projectId: string) =>
    request<ProjectSummary>(`/projects/${projectId}`, token),
  createProject: (token: string, input: CreateProjectInput) =>
    request<ProjectSummary>("/projects", token, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateProject: (
    token: string,
    projectId: string,
    input: Record<string, unknown>,
  ) =>
    request<ProjectSummary>(`/projects/${projectId}`, token, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  saveTools: (token: string, projectId: string, selections: ToolSelection[]) =>
    request<ProjectSummary>(`/projects/${projectId}/tool-selections`, token, {
      method: "POST",
      body: JSON.stringify({ selections }),
    }),
  generate: (token: string, projectId: string) =>
    request<GeneratedArtifact>(`/projects/${projectId}/generate`, token, {
      method: "POST",
      body: "{}",
    }),
  artifacts: (token: string, projectId: string) =>
    request<GeneratedArtifact[]>(`/projects/${projectId}/artifacts`, token),
  githubRepository: (token: string, projectId: string) =>
    request<GitHubRepositorySummary | null>(
      `/projects/${projectId}/github/repository`,
      token,
    ),
  publishGitHubRepository: (
    token: string,
    projectId: string,
    input: {
      name: string;
      description?: string;
      private: boolean;
      artifactId?: string;
    },
  ) =>
    request<GitHubRepositorySummary>(
      `/projects/${projectId}/github/repository`,
      token,
      { method: "POST", body: JSON.stringify(input) },
    ),
  githubRuns: (token: string, projectId: string) =>
    request<GitHubWorkflowRun[]>(
      `/projects/${projectId}/github/actions/runs`,
      token,
    ),
  synchronizeGitHubRuns: (token: string, projectId: string) =>
    request<GitHubWorkflowRun[]>(
      `/projects/${projectId}/github/actions/sync`,
      token,
      { method: "POST", body: "{}" },
    ),
  createPipeline: (token: string, projectId: string, name: string) =>
    request<PipelineDefinition>("/pipelines", token, {
      method: "POST",
      body: JSON.stringify({ projectId, name, provider: "simulated" }),
    }),
  pipelines: (token: string, projectId: string) =>
    request<PipelineDefinition[]>(`/projects/${projectId}/pipelines`, token),
  executions: (token: string, pipelineId: string) =>
    request<PipelineExecutionSummary[]>(
      `/pipelines/${pipelineId}/executions`,
      token,
    ),
  startExecution: (token: string, pipelineId: string, failStageKey?: string) =>
    request<PipelineExecutionSummary>(
      `/pipelines/${pipelineId}/executions`,
      token,
      { method: "POST", body: JSON.stringify({ failStageKey }) },
    ),
  execution: (token: string, executionId: string) =>
    request<PipelineExecutionSummary>(`/executions/${executionId}`, token),
  logs: (token: string, executionId: string) =>
    request<PipelineLog[]>(`/executions/${executionId}/logs`, token),
  analyze: (
    token: string,
    project: ProjectSummary,
    artifact?: GeneratedArtifact,
  ) =>
    request<Suggestion[]>(
      `/projects/${project.id}/suggestions/analyze`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          architectureType: project.architectureType,
          visibility: project.visibility,
          toolSelections: project.toolSelections,
          files: artifact?.files ?? [],
        }),
      },
    ),
  suggestions: (token: string, projectId: string) =>
    request<Suggestion[]>(`/projects/${projectId}/suggestions`, token),
  updateSuggestion: (
    token: string,
    suggestionId: string,
    status: SuggestionStatus,
  ) =>
    request<Suggestion>(`/suggestions/${suggestionId}`, token, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  createTarget: (
    token: string,
    projectId: string,
    name: string,
    environment: DeploymentTarget["environment"],
  ) =>
    request<DeploymentTarget>("/deployments/targets", token, {
      method: "POST",
      body: JSON.stringify({
        projectId,
        name,
        type: "kubernetes",
        environment,
        config: {},
      }),
    }),
  targets: (token: string, projectId: string) =>
    request<DeploymentTarget[]>(
      `/projects/${projectId}/deployment-targets`,
      token,
    ),
  validateManifests: (token: string, artifact: GeneratedArtifact) =>
    request<ManifestValidationResult>("/deployments/validate", token, {
      method: "POST",
      body: JSON.stringify({
        manifests: artifact.files
          .filter((file) => file.path.startsWith("kubernetes/"))
          .map(({ path, content }) => ({ path, content })),
      }),
    }),
  health: (token: string) =>
    request<PlatformHealth>("/monitoring/health", token),
  notifications: (token: string) =>
    request<Notification[]>("/notifications", token),
  templates: () => request<TemplateMetadata[]>("/templates"),
  markNotificationRead: (token: string, id: string) =>
    request<Notification>(`/notifications/${id}/read`, token, {
      method: "PATCH",
    }),
  downloadArtifact: async (
    token: string,
    artifactId: string,
  ): Promise<void> => {
    const response = await fetch(
      `${API_URL}/artifacts/${artifactId}/download`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!response.ok)
      throw new ApiClientError(
        "DOWNLOAD_FAILED",
        "The artifact archive could not be downloaded",
        response.status,
      );
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = `buildsphere-${artifactId}.tar`;
    link.click();
    URL.revokeObjectURL(url);
  },
};
