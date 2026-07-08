import type {
  GeneratedArtifact,
  ProjectSummary,
} from "@buildsphere/shared-types";
import type { Logger } from "pino";

export interface CoordinationResult {
  pipelineCreated: boolean;
  suggestionsCreated: boolean;
}

export interface DeliveryCoordinator {
  coordinate(
    token: string,
    project: ProjectSummary,
    artifact: GeneratedArtifact,
  ): Promise<CoordinationResult>;
}

export class NoopDeliveryCoordinator implements DeliveryCoordinator {
  async coordinate(): Promise<CoordinationResult> {
    return { pipelineCreated: false, suggestionsCreated: false };
  }
}

export class HttpDeliveryCoordinator implements DeliveryCoordinator {
  constructor(
    private readonly pipelineServiceUrl: string,
    private readonly aiServiceUrl: string,
    private readonly logger: Logger,
  ) {}

  async coordinate(
    token: string,
    project: ProjectSummary,
    artifact: GeneratedArtifact,
  ): Promise<CoordinationResult> {
    const headers = {
      authorization: token,
      "content-type": "application/json",
    };
    const [pipeline, suggestions] = await Promise.allSettled([
      fetch(`${this.pipelineServiceUrl}/pipelines`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          projectId: project.id,
          name: `${project.name} pipeline`,
          provider: "simulated",
        }),
        signal: AbortSignal.timeout(8_000),
      }).then((response) => {
        if (!response.ok)
          throw new Error(`Pipeline service returned ${response.status}`);
      }),
      fetch(`${this.aiServiceUrl}/projects/${project.id}/suggestions/analyze`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          architectureType: project.architectureType,
          visibility: project.visibility,
          toolSelections: project.toolSelections,
          files: artifact.files,
        }),
        signal: AbortSignal.timeout(8_000),
      }).then((response) => {
        if (!response.ok)
          throw new Error(`AI service returned ${response.status}`);
      }),
    ]);
    if (pipeline.status === "rejected")
      this.logger.warn(
        { error: pipeline.reason },
        "Default pipeline creation was skipped",
      );
    if (suggestions.status === "rejected")
      this.logger.warn(
        { error: suggestions.reason },
        "Initial suggestion analysis was skipped",
      );
    return {
      pipelineCreated: pipeline.status === "fulfilled",
      suggestionsCreated: suggestions.status === "fulfilled",
    };
  }
}
