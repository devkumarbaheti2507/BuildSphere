import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { createAuthApp } from "./app.js";
import { InMemoryAuthRepository } from "./repository.js";

const tokens = {
  accessSecret: "access-secret-for-tests-only",
  refreshSecret: "refresh-secret-for-tests-only",
  accessTtl: "15m",
  refreshTtl: "7d",
};

const withServer = async (run: (baseUrl: string) => Promise<void>) => {
  const server = createAuthApp(new InMemoryAuthRepository(), tokens).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
};

test("health endpoint reports the service status", () =>
  withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).service, "auth-service");
  }));

test("registration, login, and authenticated profile work", () =>
  withServer(async (baseUrl) => {
    const registration = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "StrongPassword123",
      }),
    });
    assert.equal(registration.status, 201);
    const registrationBody = (await registration.json()) as {
      data: { accessToken: string };
    };

    const profile = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${registrationBody.data.accessToken}` },
    });
    assert.equal(profile.status, 200);

    const login = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "ada@example.com",
        password: "StrongPassword123",
      }),
    });
    assert.equal(login.status, 200);
  }));

test("invalid registration and protected requests return structured errors", () =>
  withServer(async (baseUrl) => {
    const registration = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "A", email: "invalid", password: "short" }),
    });
    assert.equal(registration.status, 400);
    assert.equal(
      ((await registration.json()) as { error: { code: string } }).error.code,
      "VALIDATION_ERROR",
    );

    const profile = await fetch(`${baseUrl}/auth/me`);
    assert.equal(profile.status, 401);
  }));
