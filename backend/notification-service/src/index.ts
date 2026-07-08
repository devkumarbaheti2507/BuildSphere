import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLogger,
  loadEnvironment,
  registerGracefulShutdown,
  requiredEnvironment,
} from "@buildsphere/service-core";
import { createNotificationApp } from "./app.js";
import {
  InMemoryNotificationRepository,
  PostgresNotificationRepository,
} from "./repository.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
loadEnvironment(path.join(repoRoot, ".env"));
const port = Number(process.env.PORT ?? 8089);
const logger = createLogger(process.env.SERVICE_NAME ?? "notification-service");
const database =
  process.env.STORAGE_DRIVER === "memory"
    ? undefined
    : (await import("@buildsphere/service-core/database")).createDatabasePool();
const app = createNotificationApp(
  database
    ? new PostgresNotificationRepository(database)
    : new InMemoryNotificationRepository(),
  requiredEnvironment("JWT_ACCESS_TOKEN_SECRET"),
  requiredEnvironment("INTERNAL_SERVICE_TOKEN"),
  logger,
);
const server = app.listen(port, () =>
  logger.info({ port }, "Notification service listening"),
);
registerGracefulShutdown(server, database ? [database] : [], (error) =>
  logger.error({ err: error }, "Graceful shutdown failed"),
);
