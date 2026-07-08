import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { signToken } from "@buildsphere/service-core";
import { createNotificationApp } from "./app.js";
import { InMemoryNotificationRepository } from "./repository.js";

test("internal events create user-scoped notifications that can be marked read", async () => {
  const secret = "notification-test-secret";
  const internal = "internal-test-token";
  const userId = "60d10ae9-d6d9-475c-b1e9-b8916dc31078";
  const token = signToken(
    { userId, email: "user@example.com", role: "user" },
    secret,
    "access",
    "15m",
  );
  const server = createNotificationApp(
    new InMemoryNotificationRepository(),
    secret,
    internal,
  ).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const created = await fetch(`${baseUrl}/internal/notifications`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-service-token": internal,
      },
      body: JSON.stringify({
        userId,
        type: "project.created",
        title: "Project created",
        message: "Your project is ready.",
        metadata: {},
      }),
    });
    assert.equal(created.status, 201);
    const notificationId = ((await created.json()) as { data: { id: string } })
      .data.id;
    const headers = { authorization: `Bearer ${token}` };
    const listed = await fetch(`${baseUrl}/notifications`, { headers });
    assert.equal(((await listed.json()) as { data: unknown[] }).data.length, 1);
    const read = await fetch(
      `${baseUrl}/notifications/${notificationId}/read`,
      { method: "PATCH", headers },
    );
    assert.ok(
      ((await read.json()) as { data: { readAt?: string } }).data.readAt,
    );
  } finally {
    server.close();
  }
});
