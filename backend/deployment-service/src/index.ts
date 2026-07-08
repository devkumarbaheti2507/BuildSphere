import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLogger,
  loadEnvironment,
  requiredEnvironment,
} from "@buildsphere/service-core";
import { createDeploymentApp } from "./app.js";
import {
  InMemoryDeploymentRepository,
  PostgresDeploymentRepository,
} from "./repository.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
loadEnvironment(path.join(repoRoot, ".env"));
const port = Number(process.env.PORT ?? 8084);
const logger = createLogger(process.env.SERVICE_NAME ?? "deployment-service");
const database =
  process.env.STORAGE_DRIVER === "memory"
    ? undefined
    : (await import("@buildsphere/service-core/database")).createDatabasePool();
const app = createDeploymentApp(
  database
    ? new PostgresDeploymentRepository(database)
    : new InMemoryDeploymentRepository(),
  requiredEnvironment("JWT_ACCESS_TOKEN_SECRET"),
  logger,
);
const server = app.listen(port, () =>
  logger.info({ port }, "Deployment service listening"),
);
const shutdown = () => server.close(() => void database?.end());
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
