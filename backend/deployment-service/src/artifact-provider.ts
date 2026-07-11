import type { GeneratedArtifact } from "@buildsphere/shared-types";

export class ArtifactProviderError extends Error {
  constructor(
    public readonly code:
      | "DEPLOYMENT_ARTIFACT_NOT_FOUND"
      | "DEPLOYMENT_ARTIFACT_UNAVAILABLE"
      | "DEPLOYMENT_ARTIFACT_INVALID",
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export interface ProjectArtifactProvider {
  getOwnedArtifact(
    authorization: string,
    artifactId: string,
  ): Promise<GeneratedArtifact>;
}

const isArtifact = (value: unknown): value is GeneratedArtifact => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const artifact = value as Partial<GeneratedArtifact>;
  return (
    typeof artifact.id === "string" &&
    typeof artifact.projectId === "string" &&
    typeof artifact.checksum === "string" &&
    Array.isArray(artifact.files) &&
    artifact.files.every(
      (file) =>
        file &&
        typeof file.path === "string" &&
        typeof file.content === "string",
    )
  );
};

export class HttpProjectArtifactProvider implements ProjectArtifactProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 10_000,
  ) {}

  async getOwnedArtifact(
    authorization: string,
    artifactId: string,
  ): Promise<GeneratedArtifact> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/artifacts/${artifactId}`, {
        headers: { authorization },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new ArtifactProviderError(
        "DEPLOYMENT_ARTIFACT_UNAVAILABLE",
        "Project Service is unavailable while loading the deployment artifact.",
        502,
      );
    }
    if (response.status === 404) {
      throw new ArtifactProviderError(
        "DEPLOYMENT_ARTIFACT_NOT_FOUND",
        "The generated deployment artifact was not found.",
        404,
      );
    }
    if (!response.ok) {
      throw new ArtifactProviderError(
        "DEPLOYMENT_ARTIFACT_UNAVAILABLE",
        "The generated deployment artifact could not be loaded.",
        response.status === 401 || response.status === 403
          ? response.status
          : 502,
      );
    }
    const body = (await response.json().catch(() => undefined)) as
      { data?: unknown } | undefined;
    if (!isArtifact(body?.data)) {
      throw new ArtifactProviderError(
        "DEPLOYMENT_ARTIFACT_INVALID",
        "Project Service returned an invalid deployment artifact.",
        502,
      );
    }
    return body.data;
  }
}

export class InMemoryProjectArtifactProvider implements ProjectArtifactProvider {
  constructor(private readonly artifacts: GeneratedArtifact[]) {}

  async getOwnedArtifact(
    _authorization: string,
    artifactId: string,
  ): Promise<GeneratedArtifact> {
    const artifact = this.artifacts.find((item) => item.id === artifactId);
    if (!artifact) {
      throw new ArtifactProviderError(
        "DEPLOYMENT_ARTIFACT_NOT_FOUND",
        "The generated deployment artifact was not found.",
        404,
      );
    }
    return structuredClone(artifact);
  }
}
