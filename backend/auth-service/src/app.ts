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
import { AuthService, type TokenConfiguration } from "./auth-service.js";
import type { AuthRepository } from "./repository.js";

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
});
const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
});
const refreshSchema = z.object({ refreshToken: z.string().min(1) });

const validated = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "The request body is invalid", {
      fields: result.error.flatten().fieldErrors,
    });
  }
  return result.data;
};

export const createAuthApp = (
  repository: AuthRepository,
  tokens: TokenConfiguration,
  logger: Logger = createLogger("auth-service"),
): Express => {
  const app = express();
  const service = new AuthService(repository, tokens);
  const authenticate = requireAuthentication(tokens.accessSecret);

  app.use(express.json({ limit: "100kb" }));
  app.use(requestContext(logger));
  app.get("/health", healthHandler("auth-service"));

  app.post(
    "/auth/register",
    asyncHandler(async (request, response) => {
      const input = validated(registrationSchema, request.body);
      response
        .status(201)
        .json({
          data: await service.register(input.name, input.email, input.password),
          meta: {},
        });
    }),
  );

  app.post(
    "/auth/login",
    asyncHandler(async (request, response) => {
      const input = validated(loginSchema, request.body);
      response.json({
        data: await service.login(input.email, input.password),
        meta: {},
      });
    }),
  );

  app.post(
    "/auth/refresh",
    asyncHandler(async (request, response) => {
      const input = validated(refreshSchema, request.body);
      response.json({
        data: await service.refresh(input.refreshToken),
        meta: {},
      });
    }),
  );

  app.post(
    "/auth/logout",
    asyncHandler(async (request, response) => {
      const input = validated(refreshSchema, request.body);
      await service.logout(input.refreshToken);
      response.status(204).send();
    }),
  );

  app.get(
    "/auth/me",
    authenticate,
    asyncHandler(async (_request, response) => {
      response.json({
        data: await service.getUser(authenticatedUser(response).userId),
        meta: {},
      });
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
