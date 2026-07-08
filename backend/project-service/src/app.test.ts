import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { signToken } from "@buildsphere/service-core";
import { createProjectApp } from "./app.js";
import { InMemoryProjectRepository } from "./repository.js";

const secret = "project-service-test-secret";
const accessToken = signToken(
  { userId: "owner-1", email: "owner@example.com", role: "user" },
  secret,
  "access",
  "15m",
);
const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

const withServer = async (run: (baseUrl: string) => Promise<void>) => {
  const server = createProjectApp(
    new InMemoryProjectRepository(),
    repoRoot,
    secret,
  ).listen(0);
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

const authenticatedFetch = (url: string, init: RequestInit = {}) =>
  fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });

test("project workflow creates, configures, and generates inspectable files", () =>
  withServer(async (baseUrl) => {
    const created = await authenticatedFetch(`${baseUrl}/projects`, {
      method: "POST",
      body: JSON.stringify({
        name: "Order Platform",
        description: "A sample platform",
        architectureType: "microservices",
        visibility: "private",
      }),
    });
    assert.equal(created.status, 201);
    const project = ((await created.json()) as { data: { id: string } }).data;

    const tools = await authenticatedFetch(
      `${baseUrl}/projects/${project.id}/tool-selections`,
      {
        method: "POST",
        body: JSON.stringify({
          selections: [
            { category: "frontend", toolKey: "react", config: {} },
            { category: "backend", toolKey: "nodejs", config: {} },
            { category: "database", toolKey: "postgresql", config: {} },
            { category: "ci", toolKey: "github-actions", config: {} },
            { category: "container", toolKey: "docker", config: {} },
            { category: "deployment", toolKey: "kubernetes", config: {} },
          ],
        }),
      },
    );
    assert.equal(tools.status, 200);

    const generated = await authenticatedFetch(
      `${baseUrl}/projects/${project.id}/generate`,
      { method: "POST", body: "{}" },
    );
    assert.equal(generated.status, 201);
    const artifact = (
      (await generated.json()) as {
        data: { files: Array<{ path: string; content: string }> };
      }
    ).data;
    assert.ok(
      artifact.files.some((file) => file.path === "backend/Dockerfile"),
    );
    assert.ok(
      artifact.files.some((file) => file.path === ".github/workflows/ci.yml"),
    );
    assert.ok(
      artifact.files.some(
        (file) =>
          file.path === "kubernetes/deployment.yaml" &&
          file.content.includes("readinessProbe"),
      ),
    );
  }));

test("project APIs enforce authentication, ownership, validation, and unique names", () =>
  withServer(async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/projects`)).status, 401);
    const invalid = await authenticatedFetch(`${baseUrl}/projects`, {
      method: "POST",
      body: JSON.stringify({ name: "x" }),
    });
    assert.equal(invalid.status, 400);
    const input = {
      name: "Unique Project",
      architectureType: "monolith",
      visibility: "private",
    };
    assert.equal(
      (
        await authenticatedFetch(`${baseUrl}/projects`, {
          method: "POST",
          body: JSON.stringify(input),
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await authenticatedFetch(`${baseUrl}/projects`, {
          method: "POST",
          body: JSON.stringify(input),
        })
      ).status,
      409,
    );
  }));
