import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLogger,
  HttpNotificationPublisher,
  loadEnvironment,
  registerGracefulShutdown,
  requiredEnvironment,
} from "@buildsphere/service-core";
import { createPipelineApp } from "./app.js";
import { HttpLogWriter } from "./log-writer.js";
import {
  InMemoryPipelineRepository,
  PostgresPipelineRepository,
} from "./repository.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
loadEnvironment(path.join(repoRoot, ".env"));
const port = Number(process.env.PORT ?? 8083);
const logger = createLogger(process.env.SERVICE_NAME ?? "pipeline-service");
const database =
  process.env.STORAGE_DRIVER === "memory"
    ? undefined
    : (await import("@buildsphere/service-core/database")).createDatabasePool();
const notifications = new HttpNotificationPublisher(
  process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:8089",
  requiredEnvironment("INTERNAL_SERVICE_TOKEN"),
  logger,
);
const app = createPipelineApp(
  database
    ? new PostgresPipelineRepository(database)
    : new InMemoryPipelineRepository(),
  new HttpLogWriter(
    process.env.LOGGING_SERVICE_URL ?? "http://localhost:8086",
    requiredEnvironment("INTERNAL_SERVICE_TOKEN"),
  ),
  requiredEnvironment("JWT_ACCESS_TOKEN_SECRET"),
  Number(process.env.PIPELINE_STAGE_DELAY_MS ?? 700),
  logger,
  notifications,
);
const server = app.listen(port, () =>
  logger.info({ port }, "Pipeline service listening"),
);
registerGracefulShutdown(server, database ? [database] : [], (error) =>
  logger.error({ err: error }, "Graceful shutdown failed"),
);
