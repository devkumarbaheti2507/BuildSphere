import type { Logger } from "pino";
import express, { type Express } from "express";
import {
  asyncHandler,
  createLogger,
  errorHandler,
  healthHandler,
  installServiceObservability,
  notFoundHandler,
  requireAuthentication,
} from "@buildsphere/service-core";
import type { HealthChecker } from "./health-checker.js";
import { prometheusMetrics } from "./health-checker.js";

export const createMonitoringApp = (
  checker: HealthChecker,
  accessSecret: string,
  logger: Logger = createLogger("monitoring-service"),
): Express => {
  const app = express();
  installServiceObservability(app, "monitoring-service", logger, async () =>
    prometheusMetrics(await checker.check()),
  );
  app.get("/health", healthHandler("monitoring-service"));
  app.get(
    "/monitoring/health",
    requireAuthentication(accessSecret),
    asyncHandler(async (_request, response) => {
      response.json({ data: await checker.check(), meta: {} });
    }),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
