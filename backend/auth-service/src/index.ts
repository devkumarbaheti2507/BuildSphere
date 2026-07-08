import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLogger,
  loadEnvironment,
  requiredEnvironment,
} from "@buildsphere/service-core";
import { createAuthApp } from "./app.js";
import {
  InMemoryAuthRepository,
  PostgresAuthRepository,
} from "./repository.js";

const serviceName = process.env.SERVICE_NAME ?? "auth-service";
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
loadEnvironment(path.join(repoRoot, ".env"));

const port = Number(process.env.PORT ?? 8081);
const logger = createLogger(serviceName);
const database =
  process.env.STORAGE_DRIVER === "memory"
    ? undefined
    : (await import("@buildsphere/service-core/database")).createDatabasePool();
const repository = database
  ? new PostgresAuthRepository(database)
  : new InMemoryAuthRepository();
const app = createAuthApp(
  repository,
  {
    accessSecret: requiredEnvironment("JWT_ACCESS_TOKEN_SECRET"),
    refreshSecret: requiredEnvironment("JWT_REFRESH_TOKEN_SECRET"),
    accessTtl: process.env.JWT_ACCESS_TOKEN_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TOKEN_TTL ?? "7d",
  },
  logger,
);

const server = app.listen(port, () =>
  logger.info({ port }, "Auth service listening"),
);

const shutdown = () => {
  server.close(() => void database?.end());
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
