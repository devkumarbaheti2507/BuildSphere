import type { Logger } from "pino";
import express, { type Express } from "express";
import {
  createLogger,
  errorHandler,
  healthHandler,
  notFoundHandler,
  installServiceObservability,
} from "@buildsphere/service-core";

export const createAnalyticsApp = (
  logger: Logger = createLogger("analytics-service"),
): Express => {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  installServiceObservability(app, "analytics-service", logger);
  app.get("/health", healthHandler("analytics-service"));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
