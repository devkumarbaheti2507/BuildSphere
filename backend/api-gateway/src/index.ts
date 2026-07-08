import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, loadEnvironment } from "@buildsphere/service-core";
import { createGatewayApp } from "./app.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
loadEnvironment(path.join(repoRoot, ".env"));
const serviceName = process.env.SERVICE_NAME ?? "api-gateway";
const port = Number(process.env.PORT ?? 8080);
const logger = createLogger(serviceName);

const app = createGatewayApp(
  {
    auth: process.env.AUTH_SERVICE_URL ?? "http://localhost:8081",
    projects: process.env.PROJECT_SERVICE_URL ?? "http://localhost:8082",
    pipelines: process.env.PIPELINE_SERVICE_URL ?? "http://localhost:8083",
    deployments: process.env.DEPLOYMENT_SERVICE_URL ?? "http://localhost:8084",
    monitoring: process.env.MONITORING_SERVICE_URL ?? "http://localhost:8085",
    logging: process.env.LOGGING_SERVICE_URL ?? "http://localhost:8086",
    suggestions: process.env.AI_SERVICE_URL ?? "http://localhost:8087",
    notifications:
      process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:8089",
  },
  process.env.FRONTEND_URL ?? "http://localhost:5173",
  logger,
);

app.listen(port, () => logger.info({ port }, "API gateway listening"));
