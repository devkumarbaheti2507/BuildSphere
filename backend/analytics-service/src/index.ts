import path from "node:path";
import {
  createLogger,
  loadEnvironment,
  registerGracefulShutdown,
  resolveBuildSphereRoot,
} from "@buildsphere/service-core";
import { createAnalyticsApp } from "./app.js";

const repoRoot = resolveBuildSphereRoot(import.meta.url);
loadEnvironment(path.join(repoRoot, ".env"));
const port = Number(process.env.PORT ?? 8088);
const logger = createLogger(process.env.SERVICE_NAME ?? "analytics-service");
const server = createAnalyticsApp(logger).listen(port, () =>
  logger.info({ port }, "Analytics service listening"),
);
registerGracefulShutdown(server, [], (error) =>
  logger.error({ err: error }, "Graceful shutdown failed"),
);
