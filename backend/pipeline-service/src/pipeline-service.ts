import type {
  PipelineDefinition,
  PipelineExecutionStage,
  PipelineExecutionSummary,
} from "@buildsphere/shared-types";
import { ApiError, NoopNotificationPublisher } from "@buildsphere/service-core";
import type { NotificationPublisher } from "@buildsphere/service-core";
import type { LogWriter } from "./log-writer.js";
import type { PipelineRecord, PipelineRepository } from "./repository.js";
import { defaultStages } from "./stages.js";

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const terminalStatuses = ["succeeded", "failed", "cancelled"];

export class PipelineRunner {
  constructor(
    private readonly repository: PipelineRepository,
    private readonly logs: LogWriter,
    private readonly notifications: NotificationPublisher,
    private readonly stageDelayMs: number,
  ) {}

  async run(
    ownerId: string,
    definition: PipelineRecord,
    execution: PipelineExecutionSummary,
    failStageKey?: string,
  ): Promise<void> {
    const startedAt = new Date().toISOString();
    let stages = execution.stages;
    await this.repository.updateExecution(execution.id, {
      status: "running",
      stages,
      startedAt,
    });

    for (const definitionStage of definition.stages) {
      const latest = await this.repository.findExecution(ownerId, execution.id);
      if (!latest || latest.status === "cancelled") return;
      stages = stages.map((stage) =>
        stage.key === definitionStage.key
          ? { ...stage, status: "running", startedAt: new Date().toISOString() }
          : stage,
      );
      await this.repository.updateExecution(execution.id, {
        status: "running",
        stages,
        startedAt,
      });
      await this.logs.append({
        ownerId,
        executionId: execution.id,
        stageKey: definitionStage.key,
        level: "info",
        message: `Starting: ${definitionStage.name}`,
      });
      await delay(this.stageDelayMs);

      const afterDelay = await this.repository.findExecution(
        ownerId,
        execution.id,
      );
      if (!afterDelay || afterDelay.status === "cancelled") return;

      if (definitionStage.key === failStageKey) {
        const finishedAt = new Date().toISOString();
        stages = stages.map((stage) =>
          stage.key === definitionStage.key
            ? { ...stage, status: "failed", finishedAt }
            : stage,
        );
        await this.logs.append({
          ownerId,
          executionId: execution.id,
          stageKey: definitionStage.key,
          level: "error",
          message: `Failed: ${definitionStage.name}`,
        });
        await this.repository.updateExecution(execution.id, {
          status: "failed",
          stages,
          startedAt,
          finishedAt,
        });
        await this.notifications.publish({
          userId: ownerId,
          type: "pipeline.execution.failed",
          title: "Pipeline execution failed",
          message: `${definition.name} failed during ${definitionStage.name}.`,
          metadata: {
            pipelineId: definition.id,
            executionId: execution.id,
            stageKey: definitionStage.key,
          },
        });
        return;
      }

      stages = stages.map((stage) =>
        stage.key === definitionStage.key
          ? {
              ...stage,
              status: "succeeded",
              finishedAt: new Date().toISOString(),
            }
          : stage,
      );
      await this.logs.append({
        ownerId,
        executionId: execution.id,
        stageKey: definitionStage.key,
        level: "info",
        message: `Completed: ${definitionStage.name}`,
      });
      await this.repository.updateExecution(execution.id, {
        status: "running",
        stages,
        startedAt,
      });
    }
    await this.repository.updateExecution(execution.id, {
      status: "succeeded",
      stages,
      startedAt,
      finishedAt: new Date().toISOString(),
    });
  }
}

export class PipelineService {
  private readonly runner: PipelineRunner;
  constructor(
    private readonly repository: PipelineRepository,
    logs: LogWriter,
    private readonly notifications: NotificationPublisher = new NoopNotificationPublisher(),
    stageDelayMs = 700,
  ) {
    this.runner = new PipelineRunner(
      repository,
      logs,
      notifications,
      stageDelayMs,
    );
  }

  async create(
    ownerId: string,
    projectId: string,
    name: string,
    provider: PipelineDefinition["provider"],
  ): Promise<PipelineRecord> {
    const existing = (
      await this.repository.listDefinitions(ownerId, projectId)
    ).find(
      (pipeline) => pipeline.name === name && pipeline.provider === provider,
    );
    if (existing) return existing;
    const pipeline = await this.repository.createDefinition(
      ownerId,
      projectId,
      name,
      provider,
      defaultStages,
    );
    await this.notifications.publish({
      userId: ownerId,
      type: "pipeline.generated",
      title: "Pipeline generated",
      message: `${pipeline.name} contains ${pipeline.stages.length} explainable stages.`,
      metadata: { projectId, pipelineId: pipeline.id },
    });
    return pipeline;
  }
  list(ownerId: string, projectId: string): Promise<PipelineRecord[]> {
    return this.repository.listDefinitions(ownerId, projectId);
  }
  async get(ownerId: string, pipelineId: string): Promise<PipelineRecord> {
    const pipeline = await this.repository.findDefinition(ownerId, pipelineId);
    if (!pipeline)
      throw new ApiError(
        404,
        "PIPELINE_NOT_FOUND",
        "The pipeline was not found",
      );
    return pipeline;
  }
  async start(
    ownerId: string,
    pipelineId: string,
    failStageKey?: string,
  ): Promise<PipelineExecutionSummary> {
    const pipeline = await this.get(ownerId, pipelineId);
    if (
      failStageKey &&
      !pipeline.stages.some((stage) => stage.key === failStageKey)
    ) {
      throw new ApiError(
        400,
        "INVALID_FAILURE_STAGE",
        "The requested failure stage does not exist",
      );
    }
    const stages: PipelineExecutionStage[] = pipeline.stages.map((stage) => ({
      key: stage.key,
      status: "pending",
    }));
    const execution = await this.repository.createExecution(
      pipelineId,
      stages,
      "manual",
    );
    await this.notifications.publish({
      userId: ownerId,
      type: "pipeline.execution.started",
      title: "Pipeline execution started",
      message: `${pipeline.name} is running.`,
      metadata: { pipelineId, executionId: execution.id },
    });
    setImmediate(
      () =>
        void this.runner
          .run(ownerId, pipeline, execution, failStageKey)
          .catch(async () => {
            const current = await this.repository.findExecution(
              ownerId,
              execution.id,
            );
            if (current && !terminalStatuses.includes(current.status)) {
              await this.repository.updateExecution(execution.id, {
                status: "failed",
                stages: current.stages,
                startedAt: current.startedAt,
                finishedAt: new Date().toISOString(),
              });
              await this.notifications.publish({
                userId: ownerId,
                type: "pipeline.execution.failed",
                title: "Pipeline execution failed",
                message: `${pipeline.name} stopped because a supporting service failed.`,
                metadata: { pipelineId, executionId: execution.id },
              });
            }
          }),
    );
    return execution;
  }
  async executions(
    ownerId: string,
    pipelineId: string,
  ): Promise<PipelineExecutionSummary[]> {
    await this.get(ownerId, pipelineId);
    return this.repository.listExecutions(ownerId, pipelineId);
  }
  async execution(
    ownerId: string,
    executionId: string,
  ): Promise<PipelineExecutionSummary> {
    const execution = await this.repository.findExecution(ownerId, executionId);
    if (!execution)
      throw new ApiError(
        404,
        "EXECUTION_NOT_FOUND",
        "The pipeline execution was not found",
      );
    return execution;
  }
  async cancel(
    ownerId: string,
    executionId: string,
  ): Promise<PipelineExecutionSummary> {
    const execution = await this.execution(ownerId, executionId);
    if (!["queued", "running"].includes(execution.status)) {
      throw new ApiError(
        409,
        "INVALID_STATUS_TRANSITION",
        `A ${execution.status} execution cannot be cancelled`,
      );
    }
    const stages = execution.stages.map((stage): PipelineExecutionStage =>
      stage.status === "pending" ? { ...stage, status: "skipped" } : stage,
    );
    return this.repository.updateExecution(execution.id, {
      status: "cancelled",
      stages,
      startedAt: execution.startedAt,
      finishedAt: new Date().toISOString(),
    });
  }
}
