import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import { createGatewayApp, type GatewayTargets } from "./app.js";

const listen = async (app: express.Express) => {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  return {
    server,
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
  };
};

test("gateway forwards auth routes and correlation headers", async () => {
  const upstreamApp = express();
  upstreamApp.use(express.json());
  upstreamApp.post("/auth/login", (request, response) =>
    response.json({
      path: request.path,
      email: request.body.email,
      correlationId: request.header("x-correlation-id"),
    }),
  );
  const upstream = await listen(upstreamApp);
  const targets = Object.fromEntries(
    [
      "auth",
      "projects",
      "pipelines",
      "logging",
      "suggestions",
      "deployments",
      "monitoring",
      "notifications",
    ].map((key) => [key, upstream.url]),
  ) as unknown as GatewayTargets;
  const gateway = await listen(createGatewayApp(targets));
  try {
    const response = await fetch(`${gateway.url}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "ada@example.com" }),
    });
    const body = (await response.json()) as {
      path: string;
      email: string;
      correlationId: string;
    };
    assert.equal(response.status, 200);
    assert.equal(body.path, "/auth/login");
    assert.equal(body.email, "ada@example.com");
    assert.ok(body.correlationId);
  } finally {
    upstream.server.close();
    gateway.server.close();
  }
});

test("gateway returns a structured error when an upstream is unavailable", async () => {
  const unavailable = "http://127.0.0.1:1";
  const targets = {
    auth: unavailable,
    projects: unavailable,
    pipelines: unavailable,
    logging: unavailable,
    suggestions: unavailable,
    deployments: unavailable,
    monitoring: unavailable,
    notifications: unavailable,
  };
  const gateway = await listen(createGatewayApp(targets));
  try {
    const response = await fetch(`${gateway.url}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(response.status, 502);
    assert.equal(
      ((await response.json()) as { error: { code: string } }).error.code,
      "SERVICE_UNAVAILABLE",
    );
  } finally {
    gateway.server.close();
  }
});

test("gateway keeps project-scoped deployment operations on Deployment Service", async () => {
  const deploymentsApp = express();
  deploymentsApp.use(express.json());
  deploymentsApp.get(
    "/projects/:projectId/deployment-operations",
    (request, response) =>
      response.json({
        service: "deployments",
        projectId: request.params.projectId,
      }),
  );
  deploymentsApp.put(
    "/deployments/targets/:targetId/credential",
    (request, response) =>
      response.json({
        service: "deployments",
        confirmed: request.body.confirmed,
      }),
  );
  const projectApp = express();
  projectApp.use((_request, response) =>
    response.status(500).json({ service: "projects" }),
  );
  const deployments = await listen(deploymentsApp);
  const projects = await listen(projectApp);
  const unavailable = "http://127.0.0.1:1";
  const gateway = await listen(
    createGatewayApp({
      auth: unavailable,
      projects: projects.url,
      pipelines: unavailable,
      logging: unavailable,
      suggestions: unavailable,
      deployments: deployments.url,
      monitoring: unavailable,
      notifications: unavailable,
    }),
  );
  try {
    const history = await fetch(
      `${gateway.url}/api/projects/22222222-2222-4222-8222-222222222222/deployment-operations`,
    );
    assert.equal(history.status, 200);
    assert.equal(
      ((await history.json()) as { service: string }).service,
      "deployments",
    );
    const credential = await fetch(
      `${gateway.url}/api/deployments/targets/33333333-3333-4333-8333-333333333333/credential`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      },
    );
    assert.equal(credential.status, 200);
    assert.equal(
      ((await credential.json()) as { confirmed: boolean }).confirmed,
      true,
    );
    const metrics = await (await fetch(`${gateway.url}/metrics`)).text();
    assert.match(
      metrics,
      /route="\/api\/projects\/:projectId\/deployment-operations\/\*"/,
    );
    assert.doesNotMatch(metrics, /22222222-2222-4222-8222-222222222222/);
    assert.doesNotMatch(metrics, /33333333-3333-4333-8333-333333333333/);
    const preflight = await fetch(
      `${gateway.url}/api/deployments/capabilities`,
      {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      },
    );
    assert.match(
      preflight.headers.get("access-control-allow-methods") ?? "",
      /PUT/,
    );
  } finally {
    deployments.server.close();
    projects.server.close();
    gateway.server.close();
  }
});
