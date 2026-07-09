import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { signToken } from "@buildsphere/service-core";
import { createProjectApp } from "./app.js";
import type {
  GitHubIntegrationGateway,
  PublishGitHubProject,
} from "./github-integration.js";
import { InMemoryProjectRepository } from "./repository.js";

const secret = "project-service-test-secret";
const accessToken = signToken(
  { userId: "owner-1", email: "owner@example.com", role: "user" },
  secret,
  "access",
  "15m",
);
const otherAccessToken = signToken(
  { userId: "owner-2", email: "other@example.com", role: "user" },
  secret,
  "access",
  "15m",
);
const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

const withServer = async (
  run: (baseUrl: string) => Promise<void>,
  github?: GitHubIntegrationGateway,
) => {
  const server = createProjectApp(
    new InMemoryProjectRepository(),
    repoRoot,
    secret,
    undefined,
    undefined,
    undefined,
    github,
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

class TestGitHubIntegration implements GitHubIntegrationGateway {
  published?: PublishGitHubProject;
  private readonly summary = {
    projectId: "",
    githubRepositoryId: "456",
    ownerLogin: "octocat",
    name: "order-platform",
    fullName: "octocat/order-platform",
    private: true,
    defaultBranch: "main",
    htmlUrl: "https://github.com/octocat/order-platform",
    publishedFiles: 10,
    lastPublishedAt: "2026-07-09T12:00:00.000Z",
    createdAt: "2026-07-09T12:00:00.000Z",
    updatedAt: "2026-07-09T12:00:00.000Z",
  };

  async publish(input: PublishGitHubProject) {
    this.published = input;
    return { ...this.summary, projectId: input.projectId };
  }

  async repository(_userId: string, projectId: string) {
    return { ...this.summary, projectId };
  }

  async synchronizeRuns(_userId: string, projectId: string) {
    return this.runs(_userId, projectId);
  }

  async runs(_userId: string, projectId: string) {
    return [
      {
        githubRunId: "9001",
        projectId,
        name: "Build",
        status: "succeeded" as const,
        conclusion: "success",
        branch: "main",
        headSha: "abc123",
        runNumber: 7,
        event: "push",
        htmlUrl: "https://github.com/octocat/order-platform/actions/runs/9001",
        createdAt: "2026-07-09T12:00:00.000Z",
        updatedAt: "2026-07-09T12:05:00.000Z",
      },
    ];
  }
}

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

test("project GitHub endpoints publish owned artifacts and synchronize workflow runs", () => {
  const github = new TestGitHubIntegration();
  return withServer(async (baseUrl) => {
    const created = await authenticatedFetch(`${baseUrl}/projects`, {
      method: "POST",
      body: JSON.stringify({
        name: "GitHub Project",
        architectureType: "monolith",
        visibility: "private",
      }),
    });
    const projectId = ((await created.json()) as { data: { id: string } }).data
      .id;
    await authenticatedFetch(`${baseUrl}/projects/${projectId}/tool-selections`, {
      method: "POST",
      body: JSON.stringify({
        selections: [
          { category: "backend", toolKey: "nodejs", config: {} },
          { category: "ci", toolKey: "github-actions", config: {} },
        ],
      }),
    });
    await authenticatedFetch(`${baseUrl}/projects/${projectId}/generate`, {
      method: "POST",
      body: "{}",
    });

    const published = await authenticatedFetch(
      `${baseUrl}/projects/${projectId}/github/repository`,
      {
        method: "POST",
        body: JSON.stringify({ name: "github-project", private: true }),
      },
    );
    assert.equal(published.status, 200);
    assert.equal((await published.json()).data.fullName, "octocat/order-platform");
    assert.equal(github.published?.userId, "owner-1");
    assert.ok(github.published?.files.length);

    const synchronized = await authenticatedFetch(
      `${baseUrl}/projects/${projectId}/github/actions/sync`,
      { method: "POST", body: "{}" },
    );
    assert.equal(synchronized.status, 200);
    assert.equal((await synchronized.json()).data[0].status, "succeeded");

    const unauthorizedOwner = await fetch(
      `${baseUrl}/projects/${projectId}/github/actions/runs`,
      {
        headers: {
          authorization: `Bearer ${otherAccessToken}`,
          "content-type": "application/json",
        },
      },
    );
    assert.equal(unauthorizedOwner.status, 404);
  }, github);
});
