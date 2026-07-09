import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLogger,
  HttpNotificationPublisher,
  loadEnvironment,
  registerGracefulShutdown,
  requiredEnvironment,
} from "@buildsphere/service-core";
import { createProjectApp } from "./app.js";
import { HttpDeliveryCoordinator } from "./delivery-coordinator.js";
import { HttpGitHubIntegrationGateway } from "./github-integration.js";
import {
  InMemoryProjectRepository,
  PostgresProjectRepository,
} from "./repository.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
loadEnvironment(path.join(repoRoot, ".env"));
const serviceName = process.env.SERVICE_NAME ?? "project-service";
const port = Number(process.env.PORT ?? 8082);
const logger = createLogger(serviceName);
const internalToken = requiredEnvironment("INTERNAL_SERVICE_TOKEN");
const database =
  process.env.STORAGE_DRIVER === "memory"
    ? undefined
    : (await import("@buildsphere/service-core/database")).createDatabasePool();
const notifications = new HttpNotificationPublisher(
  process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:8089",
  internalToken,
  logger,
);
const delivery = new HttpDeliveryCoordinator(
  process.env.PIPELINE_SERVICE_URL ?? "http://localhost:8083",
  process.env.AI_SERVICE_URL ?? "http://localhost:8087",
  logger,
);
const app = createProjectApp(
  database
    ? new PostgresProjectRepository(database)
    : new InMemoryProjectRepository(),
  repoRoot,
  requiredEnvironment("JWT_ACCESS_TOKEN_SECRET"),
  logger,
  notifications,
  delivery,
  new HttpGitHubIntegrationGateway(
    process.env.AUTH_SERVICE_URL ?? "http://localhost:8081",
    internalToken,
  ),
);
const server = app.listen(port, () =>
  logger.info({ port }, "Project service listening"),
);
registerGracefulShutdown(server, database ? [database] : [], (error) =>
  logger.error({ err: error }, "Graceful shutdown failed"),
);
