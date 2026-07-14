import path from "node:path";
import {
  createLogger,
  loadEnvironment,
  registerGracefulShutdown,
  requiredEnvironment,
  resolveBuildSphereRoot,
} from "@buildsphere/service-core";
import { createLoggingApp } from "./app.js";
import { InMemoryLogRepository, PostgresLogRepository } from "./repository.js";

const repoRoot = resolveBuildSphereRoot(import.meta.url);
loadEnvironment(path.join(repoRoot, ".env"));
const port = Number(process.env.PORT ?? 8086);
const logger = createLogger(process.env.SERVICE_NAME ?? "logging-service");
const database =
  process.env.STORAGE_DRIVER === "memory"
    ? undefined
    : (await import("@buildsphere/service-core/database")).createDatabasePool();
const app = createLoggingApp(
  database ? new PostgresLogRepository(database) : new InMemoryLogRepository(),
  requiredEnvironment("JWT_ACCESS_TOKEN_SECRET"),
  requiredEnvironment("INTERNAL_SERVICE_TOKEN"),
  logger,
);
const server = app.listen(port, () =>
  logger.info({ port }, "Logging service listening"),
);
registerGracefulShutdown(server, database ? [database] : [], (error) =>
  logger.error({ err: error }, "Graceful shutdown failed"),
);
