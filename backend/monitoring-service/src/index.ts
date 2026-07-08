import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLogger,
  loadEnvironment,
  requiredEnvironment,
} from "@buildsphere/service-core";
import { createMonitoringApp } from "./app.js";
import { HttpHealthChecker } from "./health-checker.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
loadEnvironment(path.join(repoRoot, ".env"));
const port = Number(process.env.PORT ?? 8085);
const logger = createLogger(process.env.SERVICE_NAME ?? "monitoring-service");
const checker = new HttpHealthChecker([
  {
    service: "api-gateway",
    url: process.env.API_GATEWAY_URL ?? "http://localhost:8080",
  },
  {
    service: "auth-service",
    url: process.env.AUTH_SERVICE_URL ?? "http://localhost:8081",
  },
  {
    service: "project-service",
    url: process.env.PROJECT_SERVICE_URL ?? "http://localhost:8082",
  },
  {
    service: "pipeline-service",
    url: process.env.PIPELINE_SERVICE_URL ?? "http://localhost:8083",
  },
  {
    service: "deployment-service",
    url: process.env.DEPLOYMENT_SERVICE_URL ?? "http://localhost:8084",
  },
  {
    service: "logging-service",
    url: process.env.LOGGING_SERVICE_URL ?? "http://localhost:8086",
  },
  {
    service: "ai-service",
    url: process.env.AI_SERVICE_URL ?? "http://localhost:8087",
  },
  {
    service: "notification-service",
    url: process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:8089",
  },
]);
createMonitoringApp(
  checker,
  requiredEnvironment("JWT_ACCESS_TOKEN_SECRET"),
  logger,
).listen(port, () => logger.info({ port }, "Monitoring service listening"));
