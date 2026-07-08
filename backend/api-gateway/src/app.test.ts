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
