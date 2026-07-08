import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, loadEnvironment } from "@buildsphere/service-core";
import { createAnalyticsApp } from "./app.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
loadEnvironment(path.join(repoRoot, ".env"));
const port = Number(process.env.PORT ?? 8088);
const logger = createLogger(process.env.SERVICE_NAME ?? "analytics-service");
createAnalyticsApp(logger).listen(port, () =>
  logger.info({ port }, "Analytics service listening"),
);
