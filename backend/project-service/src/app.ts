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
import type { GenerationVariables } from "@buildsphere/shared-types";
import { ProjectService } from "./project-service.js";
import type { ProjectRepository } from "./repository.js";
import { createTarArchive } from "./tar.js";
import { TemplateCatalogService } from "./template-catalog.js";
import {
  NoopDeliveryCoordinator,
  type DeliveryCoordinator,
} from "./delivery-coordinator.js";
import {
  UnavailableGitHubIntegrationGateway,
  type GitHubIntegrationGateway,
} from "./github-integration.js";

const projectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  architectureType: z.enum(["monolith", "microservices"]),
  visibility: z.enum(["private", "public"]),
});
const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    visibility: z.enum(["private", "public"]).optional(),
    status: z.enum(["active", "archived"]).optional(),
  })
  .refine(
    (input) => Object.keys(input).length > 0,
    "At least one field is required",
  );
const toolsSchema = z.object({
  selections: z
    .array(
      z.object({
        category: z.enum([
          "frontend",
          "backend",
          "database",
          "cache",
          "ci",
          "container",
          "deployment",
          "monitoring",
          "packaging",
        ]),
        toolKey: z.enum([
          "react",
          "nodejs",
          "postgresql",
          "redis",
          "github-actions",
          "docker",
          "kubernetes",
          "prometheus",
          "helm",
        ]),
        config: z.record(z.unknown()).default({}),
      }),
    )
    .min(1),
});
const generationSchema = z.object({
  variables: z.record(z.union([z.string(), z.number()])).optional(),
});
const githubRepositorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  private: z.boolean(),
  artifactId: z.string().uuid().optional(),
});

const validated = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new ApiError(400, "VALIDATION_ERROR", "The request body is invalid", {
      fields: result.error.flatten(),
    });
  return result.data;
};

export const createProjectApp = (
  repository: ProjectRepository,
  repoRoot: string,
  accessSecret: string,
  logger: Logger = createLogger("project-service"),
  notifications: NotificationPublisher = new NoopNotificationPublisher(),
  delivery: DeliveryCoordinator = new NoopDeliveryCoordinator(),
  github: GitHubIntegrationGateway = new UnavailableGitHubIntegrationGateway(),
): Express => {
  const app = express();
  const templates = new TemplateCatalogService(repoRoot);
  const service = new ProjectService(repository, templates, github);
  const authenticate = requireAuthentication(accessSecret);

  app.use(express.json({ limit: "200kb" }));
  app.use(requestContext(logger));
  app.get("/health", healthHandler("project-service"));
  app.get("/templates", (_request, response) =>
    response.json({ data: templates.list(), meta: {} }),
  );
  app.use(authenticate);

  app.post(
    "/projects",
    asyncHandler(async (request, response) => {
      const input = validated(projectSchema, request.body);
      const userId = authenticatedUser(response).userId;
      const project = await service.create(userId, input);
      await notifications.publish({
        userId,
        type: "project.created",
        title: "Project created",
        message: `${project.name} is ready to configure.`,
        metadata: { projectId: project.id },
      });
      response.status(201).json({ data: project, meta: {} });
    }),
  );
  app.get(
    "/projects",
    asyncHandler(async (_request, response) => {
      response.json({
        data: await service.list(authenticatedUser(response).userId),
        meta: {},
      });
    }),
  );
  app.get(
    "/projects/:projectId",
    asyncHandler(async (request, response) => {
      response.json({
        data: await service.getOwned(
          authenticatedUser(response).userId,
          request.params.projectId,
        ),
        meta: {},
      });
    }),
  );
  app.patch(
    "/projects/:projectId",
    asyncHandler(async (request, response) => {
      const input = validated(updateSchema, request.body);
      response.json({
        data: await service.update(
          authenticatedUser(response).userId,
          request.params.projectId,
          input,
        ),
        meta: {},
      });
    }),
  );
  app.post(
    "/projects/:projectId/tool-selections",
    asyncHandler(async (request, response) => {
      const input = validated(toolsSchema, request.body);
      const selections = input.selections.map((selection) => ({
        ...selection,
        config: selection.config ?? {},
      }));
      response.json({
        data: await service.saveTools(
          authenticatedUser(response).userId,
          request.params.projectId,
          selections,
        ),
        meta: {},
      });
    }),
  );
  app.post(
    "/projects/:projectId/generate",
    asyncHandler(async (request, response) => {
      const input = validated(generationSchema, request.body ?? {});
      const userId = authenticatedUser(response).userId;
      const project = await service.getOwned(userId, request.params.projectId);
      const artifact = await service.generate(
        userId,
        request.params.projectId,
        (input.variables ?? {}) as Partial<GenerationVariables>,
      );
      const coordination = await delivery.coordinate(
        request.header("authorization") ?? "",
        project,
        artifact,
      );
      response.status(201).json({ data: artifact, meta: coordination });
    }),
  );
  app.get(
    "/projects/:projectId/artifacts",
    asyncHandler(async (request, response) => {
      response.json({
        data: await service.listArtifacts(
          authenticatedUser(response).userId,
          request.params.projectId,
        ),
        meta: {},
      });
    }),
  );
  app.get(
    "/artifacts/:artifactId",
    asyncHandler(async (request, response) => {
      response.json({
        data: await service.getArtifact(
          authenticatedUser(response).userId,
          request.params.artifactId,
        ),
        meta: {},
      });
    }),
  );
  app.get(
    "/artifacts/:artifactId/download",
    asyncHandler(async (request, response) => {
      const artifact = await service.getArtifact(
        authenticatedUser(response).userId,
        request.params.artifactId,
      );
      response.setHeader("content-type", "application/x-tar");
      response.setHeader(
        "content-disposition",
        `attachment; filename="buildsphere-${artifact.projectId}.tar"`,
      );
      response.send(createTarArchive(artifact.files));
    }),
  );

  app.post(
    "/projects/:projectId/github/repository",
    asyncHandler(async (request, response) => {
      const input = validated(githubRepositorySchema, request.body);
      response.json({
        data: await service.publishToGitHub(
          authenticatedUser(response).userId,
          request.params.projectId,
          input,
        ),
        meta: {},
      });
    }),
  );

  app.get(
    "/projects/:projectId/github/repository",
    asyncHandler(async (request, response) => {
      response.json({
        data:
          (await service.githubRepository(
            authenticatedUser(response).userId,
            request.params.projectId,
          )) ?? null,
        meta: {},
      });
    }),
  );

  app.post(
    "/projects/:projectId/github/actions/sync",
    asyncHandler(async (request, response) => {
      response.json({
        data: await service.synchronizeGitHubRuns(
          authenticatedUser(response).userId,
          request.params.projectId,
        ),
        meta: {},
      });
    }),
  );

  app.get(
    "/projects/:projectId/github/actions/runs",
    asyncHandler(async (request, response) => {
      response.json({
        data: await service.githubRuns(
          authenticatedUser(response).userId,
          request.params.projectId,
        ),
        meta: {},
      });
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
