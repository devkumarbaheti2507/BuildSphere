import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { signToken } from "@buildsphere/service-core";
import { createPipelineApp } from "./app.js";
import { InMemoryLogWriter } from "./log-writer.js";
import { InMemoryPipelineRepository } from "./repository.js";

const secret = "pipeline-test-secret";
const token = signToken(
  {
    userId: "5beb981c-da4d-4da8-9ba4-117f6da63d13",
    email: "user@example.com",
    role: "user",
  },
  secret,
  "access",
  "15m",
);
const auth = {
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
};

test("pipeline definition includes learning content and simulated execution succeeds with logs", async () => {
  const logs = new InMemoryLogWriter();
  const server = createPipelineApp(
    new InMemoryPipelineRepository(),
    logs,
    secret,
    1,
  ).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const created = await fetch(`${baseUrl}/pipelines`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        projectId: "98ab93c4-29dd-4333-b987-314af4769a02",
        name: "Main pipeline",
        provider: "simulated",
      }),
    });
    assert.equal(created.status, 201);
    const pipeline = (
      (await created.json()) as {
        data: { id: string; stages: Array<{ explanation: { why: string } }> };
      }
    ).data;
    assert.ok(pipeline.stages[0].explanation.why);
    const started = await fetch(
      `${baseUrl}/pipelines/${pipeline.id}/executions`,
      { method: "POST", headers: auth, body: "{}" },
    );
    assert.equal(started.status, 202);
    const executionId = ((await started.json()) as { data: { id: string } })
      .data.id;
    await new Promise((resolve) => setTimeout(resolve, 80));
    const execution = await fetch(`${baseUrl}/executions/${executionId}`, {
      headers: auth,
    });
    assert.equal(
      ((await execution.json()) as { data: { status: string } }).data.status,
      "succeeded",
    );
    assert.equal(logs.entries.length, 14);
  } finally {
    server.close();
  }
});

test("pipeline endpoints reject unauthenticated and invalid requests", async () => {
  const server = createPipelineApp(
    new InMemoryPipelineRepository(),
    new InMemoryLogWriter(),
    secret,
    0,
  ).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal(
      (await fetch(`${baseUrl}/projects/test/pipelines`)).status,
      401,
    );
    const invalid = await fetch(`${baseUrl}/pipelines`, {
      method: "POST",
      headers: auth,
      body: "{}",
    });
    assert.equal(invalid.status, 400);
  } finally {
    server.close();
  }
});

test("cancelling a running execution prevents later stages from completing", async () => {
  const server = createPipelineApp(
    new InMemoryPipelineRepository(),
    new InMemoryLogWriter(),
    secret,
    50,
  ).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const created = await fetch(`${baseUrl}/pipelines`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        projectId: "98ab93c4-29dd-4333-b987-314af4769a02",
        name: "Cancellable pipeline",
        provider: "simulated",
      }),
    });
    const pipelineId = ((await created.json()) as { data: { id: string } }).data
      .id;
    const started = await fetch(
      `${baseUrl}/pipelines/${pipelineId}/executions`,
      { method: "POST", headers: auth, body: "{}" },
    );
    const executionId = ((await started.json()) as { data: { id: string } })
      .data.id;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const cancelled = await fetch(
      `${baseUrl}/executions/${executionId}/cancel`,
      { method: "POST", headers: auth },
    );
    assert.equal(
      ((await cancelled.json()) as { data: { status: string } }).data.status,
      "cancelled",
    );
    await new Promise((resolve) => setTimeout(resolve, 70));
    const final = await fetch(`${baseUrl}/executions/${executionId}`, {
      headers: auth,
    });
    assert.equal(
      ((await final.json()) as { data: { status: string } }).data.status,
      "cancelled",
    );
  } finally {
    server.close();
  }
});
