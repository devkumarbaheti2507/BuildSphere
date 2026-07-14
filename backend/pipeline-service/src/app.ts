import type { Logger } from "pino";
import express, { type Express } from "express";
import { z } from "zod";
import {
  ApiError,
  asyncHandler,
  authenticatedUser,
  createLogger,
  errorHandler,
  healthHandler,
  NoopNotificationPublisher,
  notFoundHandler,
  installServiceObservability,
  requireAuthentication,
} from "@buildsphere/service-core";
import type { NotificationPublisher } from "@buildsphere/service-core";
import type { LogWriter } from "./log-writer.js";
import { PipelineService } from "./pipeline-service.js";
import type { PipelineRepository } from "./repository.js";

const definitionSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  provider: z.enum(["github-actions", "simulated"]).default("simulated"),
});
const executionSchema = z
  .object({ failStageKey: z.string().min(1).optional() })
  .default({});

export const createPipelineApp = (
  repository: PipelineRepository,
  logs: LogWriter,
  accessSecret: string,
  stageDelayMs = 700,
  logger: Logger = createLogger("pipeline-service"),
  notifications: NotificationPublisher = new NoopNotificationPublisher(),
): Express => {
  const app = express();
  const service = new PipelineService(
    repository,
    logs,
    notifications,
    stageDelayMs,
  );
  app.use(express.json({ limit: "100kb" }));
  installServiceObservability(app, "pipeline-service", logger);
  app.get("/health", healthHandler("pipeline-service"));
  app.use(requireAuthentication(accessSecret));

  app.post(
    "/pipelines",
    asyncHandler(async (request, response) => {
      const input = definitionSchema.safeParse(request.body);
      if (!input.success)
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "The pipeline definition is invalid",
          { fields: input.error.flatten() },
        );
      response.status(201).json({
        data: await service.create(
          authenticatedUser(response).userId,
          input.data.projectId,
          input.data.name,
          input.data.provider,
        ),
        meta: {},
      });
    }),
  );
  app.get(
    "/projects/:projectId/pipelines",
    asyncHandler(async (request, response) => {
      response.json({
        data: await service.list(
          authenticatedUser(response).userId,
          request.params.projectId,
        ),
        meta: {},
      });
    }),
  );
  app.get(
    "/pipelines/:pipelineId",
    asyncHandler(async (request, response) => {
      response.json({
        data: await service.get(
          authenticatedUser(response).userId,
          request.params.pipelineId,
        ),
        meta: {},
      });
    }),
  );
  app.post(
    "/pipelines/:pipelineId/executions",
    asyncHandler(async (request, response) => {
      const input = executionSchema.safeParse(request.body ?? {});
      if (!input.success)
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "The execution request is invalid",
          { fields: input.error.flatten() },
        );
      response.status(202).json({
        data: await service.start(
          authenticatedUser(response).userId,
          request.params.pipelineId,
          input.data.failStageKey,
        ),
        meta: {},
      });
    }),
  );
  app.get(
    "/pipelines/:pipelineId/executions",
    asyncHandler(async (request, response) => {
      response.json({
        data: await service.executions(
          authenticatedUser(response).userId,
          request.params.pipelineId,
        ),
        meta: {},
      });
    }),
  );
  app.get(
    "/executions/:executionId",
    asyncHandler(async (request, response) => {
      response.json({
        data: await service.execution(
          authenticatedUser(response).userId,
          request.params.executionId,
        ),
        meta: {},
      });
    }),
  );
  app.post(
    "/executions/:executionId/cancel",
    asyncHandler(async (request, response) => {
      response.json({
        data: await service.cancel(
          authenticatedUser(response).userId,
          request.params.executionId,
        ),
        meta: {},
      });
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
