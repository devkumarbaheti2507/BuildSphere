import path from "node:path";
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
  requestContext,
  requireAuthentication,
} from "@buildsphere/service-core";
import type { NotificationPublisher } from "@buildsphere/service-core";
import type { GeneratedFile, ToolSelection } from "@buildsphere/shared-types";
import { PromptLoader } from "./prompt-loader.js";
import type { SuggestionRepository } from "./repository.js";
import { RuleSuggestionAnalyzer, type SuggestionAnalyzer } from "./analyzer.js";

const analysisSchema = z.object({
  architectureType: z.enum(["monolith", "microservices"]).optional(),
  visibility: z.enum(["private", "public"]).optional(),
  toolSelections: z
    .array(
      z.object({
        category: z.string(),
        toolKey: z.string(),
        config: z.record(z.unknown()).optional(),
      }),
    )
    .default([]),
  files: z
    .array(
      z.object({
        path: z.string(),
        content: z.string(),
        language: z.string(),
        explanation: z.string(),
      }),
    )
    .default([]),
});
const statusSchema = z.object({
  status: z.enum(["open", "accepted", "dismissed"]),
});

export const createAiApp = (
  repository: SuggestionRepository,
  repoRoot: string,
  accessSecret: string,
  logger: Logger = createLogger("ai-service"),
  notifications: NotificationPublisher = new NoopNotificationPublisher(),
  analyzer: SuggestionAnalyzer = new RuleSuggestionAnalyzer(),
): Express => {
  const app = express();
  const prompts = new PromptLoader(path.join(repoRoot, "prompts"));
  app.use(express.json({ limit: "2mb" }));
  app.use(requestContext(logger));
  app.get("/health", healthHandler("ai-service"));
  app.use(requireAuthentication(accessSecret));

  app.get("/suggestions/prompts", (_request, response) =>
    response.json({ data: prompts.list(), meta: {} }),
  );
  app.get(
    "/suggestions/prompts/:name",
    asyncHandler(async (request, response) => {
      response.json({
        data: {
          name: request.params.name,
          content: await prompts.load(request.params.name),
        },
        meta: {},
      });
    }),
  );
  app.post(
    "/projects/:projectId/suggestions/analyze",
    asyncHandler(async (request, response) => {
      const input = analysisSchema.safeParse(request.body);
      if (!input.success)
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "The analysis input is invalid",
          { fields: input.error.flatten() },
        );
      const drafts = await analyzer.analyze(request.params.projectId, {
        architectureType: input.data.architectureType,
        visibility: input.data.visibility,
        toolSelections: input.data.toolSelections.map((selection) => ({
          ...selection,
          config: selection.config ?? {},
        })) as ToolSelection[],
        files: input.data.files as GeneratedFile[],
      });
      const suggestions = await repository.replaceForProject(
        authenticatedUser(response).userId,
        request.params.projectId,
        drafts,
      );
      if (suggestions.length) {
        await notifications.publish({
          userId: authenticatedUser(response).userId,
          type: "suggestion.created",
          title: "Project review completed",
          message: `${suggestions.length} improvement suggestions are ready.`,
          metadata: { projectId: request.params.projectId },
        });
      }
      response
        .status(201)
        .json({
          data: suggestions,
          meta: { mode: analyzer.mode, promptCount: prompts.list().length },
        });
    }),
  );
  app.get(
    "/projects/:projectId/suggestions",
    asyncHandler(async (request, response) => {
      response.json({
        data: await repository.list(
          authenticatedUser(response).userId,
          request.params.projectId,
        ),
        meta: {},
      });
    }),
  );
  app.patch(
    "/suggestions/:suggestionId",
    asyncHandler(async (request, response) => {
      const input = statusSchema.safeParse(request.body);
      if (!input.success)
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "The suggestion status is invalid",
          { fields: input.error.flatten() },
        );
      const suggestion = await repository.updateStatus(
        authenticatedUser(response).userId,
        request.params.suggestionId,
        input.data.status,
      );
      if (!suggestion)
        throw new ApiError(
          404,
          "SUGGESTION_NOT_FOUND",
          "The suggestion was not found",
        );
      response.json({ data: suggestion, meta: {} });
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
