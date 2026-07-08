import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { createAnalyticsApp } from "./app.js";

test("analytics health endpoint follows the shared service contract", async () => {
  const server = createAnalyticsApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.equal(
      ((await response.json()) as { service: string }).service,
      "analytics-service",
    );
  } finally {
    server.close();
  }
});
