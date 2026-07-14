import type { Logger } from "pino";
import express, { type Express, type RequestHandler } from "express";
import {
  ApiError,
  asyncHandler,
  createLogger,
  errorHandler,
  healthHandler,
  notFoundHandler,
  installServiceObservability,
} from "@buildsphere/service-core";

export interface GatewayTargets {
  auth: string;
  projects: string;
  pipelines: string;
  logging: string;
  suggestions: string;
  deployments: string;
  monitoring: string;
  notifications: string;
}

const proxyRequest = (
  target: string,
  metricRoute: string,
  timeoutMs = 10_000,
): RequestHandler =>
  asyncHandler(async (request, response) => {
    response.locals.metricRoute = metricRoute;
    const targetPath = request.originalUrl.replace(/^\/api/, "");
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (value && !["host", "content-length", "connection"].includes(name)) {
        headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
    }
    headers.set("x-correlation-id", response.locals.correlationId);

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(`${target}${targetPath}`, {
        method: request.method,
        headers,
        body:
          ["GET", "HEAD"].includes(request.method) || request.body === undefined
            ? undefined
            : JSON.stringify(request.body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new ApiError(
        502,
        "SERVICE_UNAVAILABLE",
        "A BuildSphere service is currently unavailable",
        {
          target: new URL(target).host,
          reason:
            error instanceof Error ? error.message : "Unknown connection error",
        },
      );
    }

    for (const header of [
      "content-type",
      "content-disposition",
      "x-correlation-id",
    ]) {
      const value = upstream.headers.get(header);
      if (value) response.setHeader(header, value);
    }
    response
      .status(upstream.status)
      .send(Buffer.from(await upstream.arrayBuffer()));
  });

const cors =
  (allowedOrigin: string): RequestHandler =>
  (request, response, next) => {
    const origin = request.header("origin");
    if (origin === allowedOrigin)
      response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "Origin");
    response.setHeader(
      "access-control-allow-headers",
      "authorization, content-type, x-correlation-id",
    );
    response.setHeader(
      "access-control-allow-methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    if (request.method === "OPTIONS") {
      response.status(204).send();
      return;
    }
    next();
  };

export const createGatewayApp = (
  targets: GatewayTargets,
  allowedOrigin = "http://localhost:5173",
  logger: Logger = createLogger("api-gateway"),
): Express => {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  installServiceObservability(app, "api-gateway", logger);
  app.use(cors(allowedOrigin));
  app.get("/health", healthHandler("api-gateway"));

  app.use(
    /^\/api\/projects\/[^/]+\/github\/repository\/?$/,
    proxyRequest(
      targets.projects,
      "/api/projects/:projectId/github/repository",
      120_000,
    ),
  );
  app.use(
    /^\/api\/projects\/[^/]+\/pipelines(?:\/|$)/,
    proxyRequest(targets.pipelines, "/api/projects/:projectId/pipelines/*"),
  );
  app.use(
    /^\/api\/projects\/[^/]+\/suggestions(?:\/|$)/,
    proxyRequest(targets.suggestions, "/api/projects/:projectId/suggestions/*"),
  );
  app.use(
    /^\/api\/projects\/[^/]+\/deployment-targets(?:\/|$)/,
    proxyRequest(
      targets.deployments,
      "/api/projects/:projectId/deployment-targets/*",
    ),
  );
  app.use(
    /^\/api\/projects\/[^/]+\/deployment-operations(?:\/|$)/,
    proxyRequest(
      targets.deployments,
      "/api/projects/:projectId/deployment-operations/*",
    ),
  );
  app.use(
    /^\/api\/executions\/[^/]+\/logs(?:\/|$)/,
    proxyRequest(targets.logging, "/api/executions/:executionId/logs/*"),
  );
  app.use("/api/auth", proxyRequest(targets.auth, "/api/auth/*"));
  app.use("/api/projects", proxyRequest(targets.projects, "/api/projects/*"));
  app.use("/api/templates", proxyRequest(targets.projects, "/api/templates/*"));
  app.use("/api/artifacts", proxyRequest(targets.projects, "/api/artifacts/*"));
  app.use(
    "/api/pipelines",
    proxyRequest(targets.pipelines, "/api/pipelines/*"),
  );
  app.use(
    "/api/executions",
    proxyRequest(targets.pipelines, "/api/executions/*"),
  );
  app.use(
    "/api/suggestions",
    proxyRequest(targets.suggestions, "/api/suggestions/*"),
  );
  app.use(
    /^\/api\/deployments\/operations(?:\/|$)/,
    proxyRequest(targets.deployments, "/api/deployments/operations/*", 120_000),
  );
  app.use(
    /^\/api\/deployments\/targets\/[^/]+\/credential(?:\/|$)/,
    proxyRequest(
      targets.deployments,
      "/api/deployments/targets/:targetId/credential/*",
      120_000,
    ),
  );
  app.use(
    "/api/deployments",
    proxyRequest(targets.deployments, "/api/deployments/*"),
  );
  app.use(
    "/api/monitoring",
    proxyRequest(targets.monitoring, "/api/monitoring/*"),
  );
  app.use(
    "/api/notifications",
    proxyRequest(targets.notifications, "/api/notifications/*"),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
