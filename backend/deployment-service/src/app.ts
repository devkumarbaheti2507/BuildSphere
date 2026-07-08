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
import type { DeploymentRepository } from "./repository.js";
import { validateKubernetesManifests } from "./validator.js";

const targetSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  type: z.literal("kubernetes").default("kubernetes"),
  environment: z.enum(["development", "staging", "production"]),
  config: z.record(z.unknown()).default({}),
});
const validationSchema = z.object({
  manifests: z
    .array(z.object({ path: z.string().min(1), content: z.string().min(1) }))
    .min(1),
});

export const createDeploymentApp = (
  repository: DeploymentRepository,
  accessSecret: string,
  logger: Logger = createLogger("deployment-service"),
): Express => {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(requestContext(logger));
  app.get("/health", healthHandler("deployment-service"));
  app.use(requireAuthentication(accessSecret));

  app.post(
    "/deployments/targets",
    asyncHandler(async (request, response) => {
      const input = targetSchema.safeParse(request.body);
      if (!input.success)
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "The deployment target is invalid",
          { fields: input.error.flatten() },
        );
      response
        .status(201)
        .json({
          data: await repository.create(
            authenticatedUser(response).userId,
            input.data,
          ),
          meta: {},
        });
    }),
  );
  app.get(
    "/projects/:projectId/deployment-targets",
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
  app.get(
    "/deployments/targets/:targetId",
    asyncHandler(async (request, response) => {
      const target = await repository.find(
        authenticatedUser(response).userId,
        request.params.targetId,
      );
      if (!target)
        throw new ApiError(
          404,
          "DEPLOYMENT_TARGET_NOT_FOUND",
          "The deployment target was not found",
        );
      response.json({ data: target, meta: {} });
    }),
  );
  app.post(
    "/deployments/validate",
    asyncHandler(async (request, response) => {
      const input = validationSchema.safeParse(request.body);
      if (!input.success)
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "Manifest input is invalid",
          { fields: input.error.flatten() },
        );
      response.json({
        data: validateKubernetesManifests(input.data.manifests),
        meta: { validator: "buildsphere-structural-v1" },
      });
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
