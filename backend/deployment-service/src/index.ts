import path from "node:path";
import {
  createLogger,
  HttpNotificationPublisher,
  loadEnvironment,
  registerGracefulShutdown,
  requiredEnvironment,
  resolveBuildSphereRoot,
} from "@buildsphere/service-core";
import { createDeploymentApp } from "./app.js";
import { HttpProjectArtifactProvider } from "./artifact-provider.js";
import { kubernetesExecutionConfigurationFromEnvironment } from "./execution-policy.js";
import { OfficialKubernetesResourceClientFactory } from "./kubernetes-client.js";
import {
  InMemoryDeploymentOperationRepository,
  PostgresDeploymentOperationRepository,
} from "./operation-repository.js";
import {
  InMemoryDeploymentRepository,
  PostgresDeploymentRepository,
} from "./repository.js";

const repoRoot = resolveBuildSphereRoot(import.meta.url);
loadEnvironment(path.join(repoRoot, ".env"));
const port = Number(process.env.PORT ?? 8084);
const logger = createLogger(process.env.SERVICE_NAME ?? "deployment-service");
const database =
  process.env.STORAGE_DRIVER === "memory"
    ? undefined
    : (await import("@buildsphere/service-core/database")).createDatabasePool();
const executionConfiguration =
  kubernetesExecutionConfigurationFromEnvironment();
const repository = database
  ? new PostgresDeploymentRepository(database)
  : new InMemoryDeploymentRepository();
const app = createDeploymentApp(
  repository,
  requiredEnvironment("JWT_ACCESS_TOKEN_SECRET"),
  logger,
  {
    operationRepository: database
      ? new PostgresDeploymentOperationRepository(database)
      : new InMemoryDeploymentOperationRepository(),
    artifactProvider: new HttpProjectArtifactProvider(
      process.env.PROJECT_SERVICE_URL ?? "http://localhost:8082",
    ),
    kubernetesClients: new OfficialKubernetesResourceClientFactory(
      executionConfiguration.policy.requestTimeoutMs,
    ),
    executionConfiguration,
    notifications: new HttpNotificationPublisher(
      process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:8089",
      requiredEnvironment("INTERNAL_SERVICE_TOKEN"),
      logger,
    ),
  },
);
const server = app.listen(port, () =>
  logger.info({ port }, "Deployment service listening"),
);
registerGracefulShutdown(server, database ? [database] : [], (error) =>
  logger.error({ err: error }, "Graceful shutdown failed"),
);
