import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import pino from "pino";
import { installServiceObservability } from "./http.js";

const listen = async (service: string) => {
  const app = express();
  installServiceObservability(app, service, pino({ level: "silent" }));
  app.get("/projects/:projectId", (_request, response) => {
    response.json({ data: {} });
  });
  app.use((_request, response) => {
    response.status(404).json({ error: { code: "NOT_FOUND" } });
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { baseUrl, server };
};

test("service metrics expose RED and runtime metrics without raw route values", async () => {
  const { baseUrl, server } = await listen("metrics-test-service");
  try {
    await fetch(`${baseUrl}/projects/private-project-id?token=private-token`);
    await fetch(`${baseUrl}/missing/private-path-value`);
    await fetch(`${baseUrl}/method/private-method`, {
      method: "PROPFIND",
    });

    const response = await fetch(`${baseUrl}/metrics`);
    const body = await response.text();

    assert.equal(response.status, 200);
    const contentType = response.headers.get("content-type") ?? "";
    assert.match(contentType, /^text\/plain;/);
    assert.match(contentType, /version=0\.0\.4/);
    assert.match(contentType, /charset=utf-8/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(body, /buildsphere_http_requests_total/);
    assert.match(body, /buildsphere_http_request_duration_seconds_bucket/);
    assert.match(body, /buildsphere_http_requests_in_flight/);
    assert.match(body, /buildsphere_process_cpu_user_seconds_total/);
    assert.match(body, /service="metrics-test-service"/);
    assert.match(body, /route="\/projects\/:projectId"/);
    assert.match(body, /route="unmatched"/);
    assert.match(body, /method="OTHER"/);
    assert.doesNotMatch(body, /private-project-id/);
    assert.doesNotMatch(body, /private-path-value/);
    assert.doesNotMatch(body, /private-token/);
    assert.doesNotMatch(body, /PROPFIND/);
    assert.doesNotMatch(body, /route="\/metrics"/);
  } finally {
    server.close();
  }
});

test("service metrics registries remain isolated between app instances", async () => {
  const first = await listen("first-service");
  const second = await listen("second-service");
  try {
    await fetch(`${first.baseUrl}/projects/first-project`);
    const secondMetrics = await (
      await fetch(`${second.baseUrl}/metrics`)
    ).text();

    assert.match(secondMetrics, /service="second-service"/);
    assert.doesNotMatch(secondMetrics, /service="first-service"/);
    assert.doesNotMatch(secondMetrics, /route="\/projects\/:projectId"/);
  } finally {
    first.server.close();
    second.server.close();
  }
});
