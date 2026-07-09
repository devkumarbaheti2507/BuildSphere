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
import type { GitHubIntegrationService } from "./github-integration.js";
import type { GitHubOAuthService } from "./github-oauth.js";
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
const githubAuthorizationSchema = z.object({
  codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
});
const githubCallbackSchema = z.object({
  code: z.string().min(1).max(500),
  state: z.string().min(1).max(5_000),
  codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
});
const internalUserSchema = z.object({ userId: z.string().uuid() });
const internalPublishSchema = z.object({
  userId: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  private: z.boolean(),
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(1024),
        content: z.string(),
        language: z.string().max(100),
        explanation: z.string().max(2_000),
      }),
    )
    .min(1)
    .max(100),
});

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
  github?: GitHubOAuthService,
  githubIntegration?: GitHubIntegrationService,
  internalToken = "",
): Express => {
  const app = express();
  const service = new AuthService(repository, tokens, github);
  const authenticate = requireAuthentication(tokens.accessSecret);

  app.use(express.json({ limit: "12mb" }));
  app.use(requestContext(logger));
  app.get("/health", healthHandler("auth-service"));

  const requireInternalToken = (value: string | undefined) => {
    if (!internalToken || value !== internalToken) {
      throw new ApiError(
        401,
        "INVALID_SERVICE_TOKEN",
        "A valid internal service token is required",
      );
    }
  };
  const requiredGitHubIntegration = () => {
    if (!githubIntegration) {
      throw new ApiError(
        503,
        "GITHUB_AUTH_NOT_CONFIGURED",
        "GitHub authentication is not configured",
      );
    }
    return githubIntegration;
  };

  app.post(
    "/internal/github/repositories",
    asyncHandler(async (request, response) => {
      requireInternalToken(request.header("x-internal-service-token"));
      const input = validated(internalPublishSchema, request.body);
      response.status(201).json({
        data: await requiredGitHubIntegration().publishRepository(input),
        meta: {},
      });
    }),
  );

  app.get(
    "/internal/github/projects/:projectId/repository",
    asyncHandler(async (request, response) => {
      requireInternalToken(request.header("x-internal-service-token"));
      const input = validated(internalUserSchema, request.query);
      response.json({
        data:
          (await requiredGitHubIntegration().getRepository(
            input.userId,
            request.params.projectId,
          )) ?? null,
        meta: {},
      });
    }),
  );

  app.post(
    "/internal/github/projects/:projectId/actions/sync",
    asyncHandler(async (request, response) => {
      requireInternalToken(request.header("x-internal-service-token"));
      const input = validated(internalUserSchema, request.body);
      response.json({
        data: await requiredGitHubIntegration().synchronizeWorkflowRuns(
          input.userId,
          request.params.projectId,
        ),
        meta: {},
      });
    }),
  );

  app.get(
    "/internal/github/projects/:projectId/actions/runs",
    asyncHandler(async (request, response) => {
      requireInternalToken(request.header("x-internal-service-token"));
      const input = validated(internalUserSchema, request.query);
      response.json({
        data: await requiredGitHubIntegration().listWorkflowRuns(
          input.userId,
          request.params.projectId,
        ),
        meta: {},
      });
    }),
  );

  app.get("/auth/providers", (_request, response) => {
    response.json({ data: service.providers(), meta: {} });
  });

  app.post(
    "/auth/github/authorize",
    asyncHandler(async (request, response) => {
      const input = validated(githubAuthorizationSchema, request.body);
      response.json({
        data: service.beginGitHubAuthorization(input.codeChallenge),
        meta: {},
      });
    }),
  );

  app.post(
    "/auth/github/callback",
    asyncHandler(async (request, response) => {
      const input = validated(githubCallbackSchema, request.body);
      response.json({
        data: await service.loginWithGitHub(
          input.code,
          input.state,
          input.codeVerifier,
        ),
        meta: {},
      });
    }),
  );

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
