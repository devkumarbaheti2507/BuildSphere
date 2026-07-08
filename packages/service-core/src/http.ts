import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import pino, { type Logger } from "pino";

export const createLogger = (service: string): Logger =>
  pino({
    name: service,
    level: process.env.LOG_LEVEL ?? "info",
    base: { service },
  });

export const requestContext =
  (logger: Logger): RequestHandler =>
  (request, response, next) => {
    const correlationId =
      request.header("x-correlation-id")?.trim() || randomUUID();
    const requestLogger = logger.child({
      correlationId,
      method: request.method,
      path: request.path,
    });
    const startedAt = performance.now();

    response.locals.correlationId = correlationId;
    response.locals.logger = requestLogger;
    response.setHeader("x-correlation-id", correlationId);

    response.on("finish", () => {
      requestLogger.info(
        {
          statusCode: response.statusCode,
          responseTimeMs: Math.round(performance.now() - startedAt),
        },
        "Request completed",
      );
    });

    next();
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
