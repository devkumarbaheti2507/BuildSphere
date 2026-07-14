import { randomUUID } from "node:crypto";
import type { Express, Request, RequestHandler, Response } from "express";
import pino, { type Logger } from "pino";
import {
  type AdditionalMetrics,
  metricsHandler,
  ServiceMetrics,
} from "./metrics.js";

const metricMethods = new Set([
  "DELETE",
  "GET",
  "HEAD",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT",
]);

const metricMethod = (method: string): string => {
  const normalized = method.toUpperCase();
  return metricMethods.has(normalized) ? normalized : "OTHER";
};

export const createLogger = (service: string): Logger =>
  pino({
    name: service,
    level: process.env.LOG_LEVEL ?? "info",
    base: { service },
  });

export const requestContext =
  (logger: Logger, metrics?: ServiceMetrics): RequestHandler =>
  (request, response, next) => {
    const correlationId =
      request.header("x-correlation-id")?.trim() || randomUUID();
    const requestLogger = logger.child({
      correlationId,
      method: request.method,
      path: request.path,
    });
    const startedAt = performance.now();
    const method = metricMethod(request.method);
    const collectMetrics = request.path !== "/metrics" ? metrics : undefined;
    let metricsCompleted = false;

    response.locals.correlationId = correlationId;
    response.locals.logger = requestLogger;
    response.setHeader("x-correlation-id", correlationId);

    collectMetrics?.begin(method);

    const completeMetrics = (statusCode: number) => {
      if (!collectMetrics || metricsCompleted) return;
      metricsCompleted = true;
      collectMetrics.complete({
        durationSeconds: (performance.now() - startedAt) / 1_000,
        method,
        route: metricRoute(request, response),
        statusCode,
      });
    };

    response.on("finish", () => {
      completeMetrics(response.statusCode);
      requestLogger.info(
        {
          statusCode: response.statusCode,
          responseTimeMs: Math.round(performance.now() - startedAt),
        },
        "Request completed",
      );
    });
    response.on("close", () => {
      completeMetrics(response.writableEnded ? response.statusCode : 499);
    });

    next();
  };

const metricRoute = (request: Request, response: Response): string => {
  const explicitRoute = response.locals.metricRoute;
  if (typeof explicitRoute === "string" && explicitRoute.length > 0) {
    return explicitRoute;
  }

  const route = request.route as { path?: unknown } | undefined;
  if (typeof route?.path === "string") {
    return `${request.baseUrl}${route.path}` || "/";
  }
  if (
    Array.isArray(route?.path) &&
    route.path.length > 0 &&
    route.path.every((path) => typeof path === "string")
  ) {
    return route.path.join("|");
  }
  return "unmatched";
};

export const installServiceObservability = (
  app: Express,
  service: string,
  logger: Logger,
  additionalMetrics?: AdditionalMetrics,
): ServiceMetrics => {
  const metrics = new ServiceMetrics(service);
  app.use(requestContext(logger, metrics));
  app.get("/metrics", metricsHandler(metrics, additionalMetrics));
  return metrics;
};

export const healthHandler =
  (service: string): RequestHandler =>
  (_request, response) => {
    response.json({
      service,
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  };
