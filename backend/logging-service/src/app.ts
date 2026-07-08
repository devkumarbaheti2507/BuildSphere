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
  notFoundHandler,
  requestContext,
  requireAuthentication,
} from "@buildsphere/service-core";
import type { LogRepository } from "./repository.js";

const appendSchema = z.object({
  ownerId: z.string().uuid(),
  executionId: z.string().uuid(),
  stageKey: z.string().min(1).max(100),
  level: z.enum(["info", "warn", "error"]),
  message: z.string().min(1).max(10_000),
});

export const createLoggingApp = (
  repository: LogRepository,
  accessSecret: string,
  internalToken: string,
  logger: Logger = createLogger("logging-service"),
): Express => {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.use(requestContext(logger));
  app.get("/health", healthHandler("logging-service"));

  app.post(
    "/internal/logs",
    asyncHandler(async (request, response) => {
      if (request.header("x-internal-service-token") !== internalToken) {
        throw new ApiError(
          401,
          "INVALID_SERVICE_TOKEN",
          "A valid internal service token is required",
        );
      }
      const parsed = appendSchema.safeParse(request.body);
      if (!parsed.success)
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "The log entry is invalid",
          { fields: parsed.error.flatten() },
        );
      response
        .status(201)
        .json({ data: await repository.append(parsed.data), meta: {} });
    }),
  );

  app.get(
    "/executions/:executionId/logs",
    requireAuthentication(accessSecret),
    asyncHandler(async (request, response) => {
      response.json({
        data: await repository.list(
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
