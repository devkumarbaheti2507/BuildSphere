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
  installServiceObservability,
  requireAuthentication,
} from "@buildsphere/service-core";
import type { NotificationRepository } from "./repository.js";

const createSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum([
    "project.created",
    "pipeline.generated",
    "pipeline.execution.started",
    "pipeline.execution.failed",
    "suggestion.created",
    "deployment.succeeded",
    "deployment.failed",
    "deployment.rolled_back",
  ]),
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(500),
  metadata: z.record(z.unknown()).default({}),
});

export const createNotificationApp = (
  repository: NotificationRepository,
  accessSecret: string,
  internalToken: string,
  logger: Logger = createLogger("notification-service"),
): Express => {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  installServiceObservability(app, "notification-service", logger);
  app.get("/health", healthHandler("notification-service"));
  app.post(
    "/internal/notifications",
    asyncHandler(async (request, response) => {
      if (request.header("x-internal-service-token") !== internalToken) {
        throw new ApiError(
          401,
          "INVALID_SERVICE_TOKEN",
          "A valid internal service token is required",
        );
      }
      const input = createSchema.safeParse(request.body);
      if (!input.success)
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "The notification is invalid",
          { fields: input.error.flatten() },
        );
      response
        .status(201)
        .json({ data: await repository.create(input.data), meta: {} });
    }),
  );
  app.get(
    "/notifications",
    requireAuthentication(accessSecret),
    asyncHandler(async (_request, response) => {
      response.json({
        data: await repository.list(authenticatedUser(response).userId),
        meta: {},
      });
    }),
  );
  app.patch(
    "/notifications/:notificationId/read",
    requireAuthentication(accessSecret),
    asyncHandler(async (request, response) => {
      const notification = await repository.markRead(
        authenticatedUser(response).userId,
        request.params.notificationId,
      );
      if (!notification)
        throw new ApiError(
          404,
          "NOTIFICATION_NOT_FOUND",
          "The notification was not found",
        );
      response.json({ data: notification, meta: {} });
    }),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
