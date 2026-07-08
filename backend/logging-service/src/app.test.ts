import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { signToken } from "@buildsphere/service-core";
import { createLoggingApp } from "./app.js";
import { InMemoryLogRepository } from "./repository.js";

const secret = "logging-test-secret";
const internalToken = "internal-test-token";
const userId = "a4a39a6e-bc92-43ec-bde5-7cf1e8fc8ccb";
const executionId = "4af4701e-7672-4470-a670-98423e272c84";
const accessToken = signToken(
  { userId, email: "user@example.com", role: "user" },
  secret,
  "access",
  "15m",
);

test("internal ingestion and owner-scoped retrieval work", async () => {
  const server = createLoggingApp(
    new InMemoryLogRepository(),
    secret,
    internalToken,
  ).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
    const append = await fetch(`${baseUrl}/internal/logs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-service-token": internalToken,
      },
      body: JSON.stringify({
        ownerId: userId,
        executionId,
        stageKey: "checkout",
        level: "info",
        message: "Repository checked out",
      }),
    });
    assert.equal(append.status, 201);
    const logs = await fetch(`${baseUrl}/executions/${executionId}/logs`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(logs.status, 200);
    assert.equal(((await logs.json()) as { data: unknown[] }).data.length, 1);
    assert.equal(
      (await fetch(`${baseUrl}/executions/${executionId}/logs`)).status,
      401,
    );
  } finally {
    server.close();
  }
});
