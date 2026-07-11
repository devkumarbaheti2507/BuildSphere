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
import type { NotificationPublisher } from "@buildsphere/service-core";
import {
  ArtifactProviderError,
  InMemoryProjectArtifactProvider,
  type ProjectArtifactProvider,
} from "./artifact-provider.js";
import { ExecutionCredentialError } from "./credential.js";
import { ExecutableManifestError } from "./executable-manifests.js";
import {
  disabledKubernetesExecutionConfiguration,
  type KubernetesExecutionConfiguration,
} from "./execution-policy.js";
import {
  OfficialKubernetesResourceClientFactory,
  type KubernetesResourceClientFactory,
} from "./kubernetes-client.js";
import type { DeploymentRepository } from "./repository.js";
import { inspectKubeconfig, KubeconfigInspectionError } from "./kubeconfig.js";
import {
  InMemoryDeploymentOperationRepository,
  type DeploymentOperationRepository,
} from "./operation-repository.js";
import {
  DeploymentOperationService,
  DeploymentOperationServiceError,
} from "./operation-service.js";
import { buildDeploymentPlan, DeploymentPlanError } from "./planner.js";
import { validateKubernetesManifests } from "./validator.js";

const kubeconfigSchema = z
  .string()
  .min(1)
  .max(1024 * 1024);
const targetSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  type: z.literal("kubernetes").default("kubernetes"),
  environment: z.enum(["development", "staging", "production"]),
  kubeconfig: kubeconfigSchema.optional(),
});
const validationSchema = z.object({
  manifests: z
    .array(z.object({ path: z.string().min(1), content: z.string().min(1) }))
    .min(1),
});
const inspectionSchema = z.object({ kubeconfig: kubeconfigSchema });
const planSchema = z.object({
  targetId: z.string().uuid(),
  manifests: z
    .array(
      z.object({
        path: z.string().min(1).max(500),
        content: z
          .string()
          .min(1)
          .max(512 * 1024),
      }),
    )
    .min(1)
    .max(100),
});
const credentialSchema = z.object({
  kubeconfig: kubeconfigSchema,
  confirmed: z.literal(true),
});
const approvalSchema = z.object({
  targetId: z.string().uuid(),
  artifactId: z.string().uuid(),
  action: z.literal("apply"),
  confirmed: z.literal(true),
});
const operationSchema = z.object({
  approvalId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});
const rollbackSchema = operationSchema;

export interface DeploymentAppDependencies {
  operationRepository?: DeploymentOperationRepository;
  artifactProvider?: ProjectArtifactProvider;
  kubernetesClients?: KubernetesResourceClientFactory;
  executionConfiguration?: KubernetesExecutionConfiguration;
  notifications?: NotificationPublisher;
  now?: () => Date;
}

const inspectOrThrow = (kubeconfig: string) => {
  try {
    return inspectKubeconfig(kubeconfig);
  } catch (error) {
    if (error instanceof KubeconfigInspectionError) {
      throw new ApiError(400, "KUBECONFIG_INVALID", error.message, {
        reasonCode: error.code,
      });
    }
    throw error;
  }
};

const operationError = (error: unknown): never => {
  if (error instanceof DeploymentOperationServiceError) {
    throw new ApiError(error.status, error.code, error.message);
  }
  if (error instanceof ArtifactProviderError) {
    throw new ApiError(error.status, error.code, error.message);
  }
  if (error instanceof ExecutionCredentialError) {
    throw new ApiError(400, error.code, error.message);
  }
  if (error instanceof KubeconfigInspectionError) {
    throw new ApiError(400, "KUBECONFIG_INVALID", error.message, {
      reasonCode: error.code,
    });
  }
  if (error instanceof ExecutableManifestError) {
    throw new ApiError(
      error.code === "KUBERNETES_CREDENTIAL_REQUIRED" ? 409 : 400,
      error.code,
      error.message,
      error.details,
    );
  }
  if (error instanceof DeploymentPlanError) {
    throw new ApiError(
      error.code === "KUBERNETES_CONNECTION_REQUIRED" ? 409 : 400,
      error.code,
      error.message,
      error.details,
    );
  }
  throw error;
};

const validated = <T>(
  schema: z.ZodType<T>,
  value: unknown,
  message: string,
): T => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, "VALIDATION_ERROR", message, {
      fields: result.error.flatten(),
    });
  }
  return result.data;
};

export const createDeploymentApp = (
  repository: DeploymentRepository,
  accessSecret: string,
  logger: Logger = createLogger("deployment-service"),
  dependencies: DeploymentAppDependencies = {},
): Express => {
  const app = express();
  const configuration =
    dependencies.executionConfiguration ??
    disabledKubernetesExecutionConfiguration();
  const operationService = new DeploymentOperationService(
    repository,
    dependencies.operationRepository ??
      new InMemoryDeploymentOperationRepository(),
    dependencies.artifactProvider ?? new InMemoryProjectArtifactProvider([]),
    dependencies.kubernetesClients ??
      new OfficialKubernetesResourceClientFactory(
        configuration.policy.requestTimeoutMs,
      ),
    configuration,
    dependencies.notifications,
    dependencies.now,
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(requestContext(logger));
  app.get("/health", healthHandler("deployment-service"));
  app.use(requireAuthentication(accessSecret));

  app.get("/deployments/capabilities", (_request, response) => {
    response.json({ data: operationService.capabilities(), meta: {} });
  });

  app.post(
    "/deployments/kubernetes/inspect",
    asyncHandler(async (request, response) => {
      const input = inspectionSchema.safeParse(request.body);
      if (!input.success) {
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "The kubeconfig inspection input is invalid",
          { fields: input.error.flatten() },
        );
      }
      response.json({
        data: inspectOrThrow(input.data.kubeconfig),
        meta: { inspector: "kubernetes-client-node-v1" },
      });
    }),
  );

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
      const inspection = input.data.kubeconfig
        ? inspectOrThrow(input.data.kubeconfig)
        : undefined;
      response.status(201).json({
        data: await repository.create(authenticatedUser(response).userId, {
          projectId: input.data.projectId,
          name: input.data.name,
          environment: input.data.environment,
          config: inspection
            ? {
                connectionStatus: "inspected",
                connection: inspection.connection,
              }
            : { connectionStatus: "draft" },
        }),
        meta: { connectionWarnings: inspection?.warnings ?? [] },
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
  app.put(
    "/deployments/targets/:targetId/credential",
    asyncHandler(async (request, response) => {
      const input = validated(
        credentialSchema,
        request.body,
        "The Kubernetes credential request is invalid",
      );
      try {
        response.json({
          data: await operationService.storeCredential(
            authenticatedUser(response).userId,
            request.params.targetId,
            input.kubeconfig,
          ),
          meta: {},
        });
      } catch (error) {
        operationError(error);
      }
    }),
  );
  app.delete(
    "/deployments/targets/:targetId/credential",
    asyncHandler(async (request, response) => {
      try {
        response.json({
          data: await operationService.revokeCredential(
            authenticatedUser(response).userId,
            request.params.targetId,
          ),
          meta: {},
        });
      } catch (error) {
        operationError(error);
      }
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
  app.post(
    "/deployments/plans",
    asyncHandler(async (request, response) => {
      const input = planSchema.safeParse(request.body);
      if (!input.success) {
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "The deployment plan input is invalid",
          { fields: input.error.flatten() },
        );
      }
      const target = await repository.find(
        authenticatedUser(response).userId,
        input.data.targetId,
      );
      if (!target) {
        throw new ApiError(
          404,
          "DEPLOYMENT_TARGET_NOT_FOUND",
          "The deployment target was not found",
        );
      }
      try {
        response.json({
          data: buildDeploymentPlan(target, input.data.manifests),
          meta: { planner: "buildsphere-offline-preflight-v1" },
        });
      } catch (error) {
        if (error instanceof DeploymentPlanError) {
          throw new ApiError(
            error.code === "KUBERNETES_CONNECTION_REQUIRED" ? 409 : 400,
            error.code,
            error.message,
            error.details,
          );
        }
        throw error;
      }
    }),
  );

  app.post(
    "/deployments/approvals",
    asyncHandler(async (request, response) => {
      const input = validated(
        approvalSchema,
        request.body,
        "The deployment approval request is invalid",
      );
      try {
        response.status(201).json({
          data: await operationService.createApplyApproval(
            authenticatedUser(response).userId,
            request.header("authorization") ?? "",
            input.targetId,
            input.artifactId,
          ),
          meta: {},
        });
      } catch (error) {
        operationError(error);
      }
    }),
  );

  app.post(
    "/deployments/operations",
    asyncHandler(async (request, response) => {
      const input = validated(
        operationSchema,
        request.body,
        "The deployment operation request is invalid",
      );
      try {
        response.status(201).json({
          data: await operationService.executeApply(
            authenticatedUser(response).userId,
            request.header("authorization") ?? "",
            input.approvalId,
            input.idempotencyKey,
          ),
          meta: {},
        });
      } catch (error) {
        operationError(error);
      }
    }),
  );

  app.get(
    "/projects/:projectId/deployment-operations",
    asyncHandler(async (request, response) => {
      response.json({
        data: await operationService.list(
          authenticatedUser(response).userId,
          request.params.projectId,
        ),
        meta: {},
      });
    }),
  );

  app.get(
    "/deployments/operations/:operationId",
    asyncHandler(async (request, response) => {
      try {
        response.json({
          data: await operationService.get(
            authenticatedUser(response).userId,
            request.params.operationId,
          ),
          meta: {},
        });
      } catch (error) {
        operationError(error);
      }
    }),
  );

  app.post(
    "/deployments/operations/:operationId/refresh",
    asyncHandler(async (request, response) => {
      try {
        response.json({
          data: await operationService.refresh(
            authenticatedUser(response).userId,
            request.header("authorization") ?? "",
            request.params.operationId,
          ),
          meta: {},
        });
      } catch (error) {
        operationError(error);
      }
    }),
  );

  app.post(
    "/deployments/operations/:operationId/rollback-approval",
    asyncHandler(async (request, response) => {
      const input = validated(
        z.object({ confirmed: z.literal(true) }),
        request.body,
        "The rollback approval request is invalid",
      );
      void input;
      try {
        response.status(201).json({
          data: await operationService.createRollbackApproval(
            authenticatedUser(response).userId,
            request.params.operationId,
          ),
          meta: {},
        });
      } catch (error) {
        operationError(error);
      }
    }),
  );

  app.post(
    "/deployments/operations/:operationId/rollback",
    asyncHandler(async (request, response) => {
      const input = validated(
        rollbackSchema,
        request.body,
        "The rollback request is invalid",
      );
      try {
        response.status(201).json({
          data: await operationService.executeRollback(
            authenticatedUser(response).userId,
            request.header("authorization") ?? "",
            request.params.operationId,
            input.approvalId,
            input.idempotencyKey,
          ),
          meta: {},
        });
      } catch (error) {
        operationError(error);
      }
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
