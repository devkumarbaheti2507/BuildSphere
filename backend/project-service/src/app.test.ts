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
            { category: "packaging", toolKey: "helm", config: {} },
            {
              category: "infrastructure",
              toolKey: "terraform-aws-eks",
              config: {},
            },
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
    assert.equal(artifact.files.length, 26);
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
    const chart = artifact.files.find(
      (file) => file.path === "helm/Chart.yaml",
    );
    assert.deepEqual(
      artifact.files
        .filter((file) => file.path.startsWith("helm/"))
        .map((file) => file.path),
      [
        "helm/Chart.yaml",
        "helm/values.yaml",
        "helm/templates/_helpers.tpl",
        "helm/templates/deployment.yaml",
        "helm/templates/service.yaml",
        "helm/templates/ingress.yaml",
        "helm/templates/NOTES.txt",
      ],
    );
    for (const file of artifact.files.filter((file) =>
      file.path.startsWith("helm/"),
    )) {
      assert.doesNotMatch(
        file.content,
        /{{\s*(?:projectName|serviceName|containerPort|imageName|imageTag|namespace|replicas|host|dbName|dbUser|dbPassword)\s*}}/,
      );
    }
    assert.match(chart?.content ?? "", /^apiVersion: v2$/m);
    assert.match(chart?.content ?? "", /^name: order-platform$/m);
    const values = artifact.files.find(
      (file) => file.path === "helm/values.yaml",
    );
    assert.match(values?.content ?? "", /repository: order-platform-service/);
    assert.match(values?.content ?? "", /host: order-platform\.local/);
    const helmDeployment = artifact.files.find(
      (file) => file.path === "helm/templates/deployment.yaml",
    );
    assert.match(helmDeployment?.content ?? "", /{{ \.Values\.replicaCount }}/);
    assert.match(
      helmDeployment?.content ?? "",
      /include "order-platform\.fullname"/,
    );
    const workflow = artifact.files.find(
      (file) => file.path === ".github/workflows/ci.yml",
    );
    assert.match(workflow?.content ?? "", /\[\[ -f helm\/Chart\.yaml \]\]/);
    const terraformFiles = artifact.files.filter((file) =>
      file.path.startsWith("terraform/"),
    );
    assert.deepEqual(
      terraformFiles.map((file) => file.path),
      [
        "terraform/versions.tf",
        "terraform/providers.tf",
        "terraform/variables.tf",
        "terraform/main.tf",
        "terraform/outputs.tf",
        "terraform/terraform.tfvars.example",
        "terraform/backend.tf.example",
        "terraform/.gitignore",
        "terraform/README.md",
      ],
    );
    for (const file of terraformFiles) {
      assert.doesNotMatch(
        file.content,
        /{{\s*(?:serviceName|awsRegion|environment)\s*}}/,
      );
      assert.doesNotMatch(
        file.content,
        /(?:access_key|secret_key|session_token)\s*=/i,
      );
    }
    const terraformVariables = terraformFiles.find(
      (file) => file.path === "terraform/variables.tf",
    );
    assert.match(
      terraformVariables?.content ?? "",
      /variable "enable_cluster"[\s\S]*?default\s*=\s*false/,
    );
    assert.match(
      terraformVariables?.content ?? "",
      /variable "cluster_name"[\s\S]*?default\s*=\s*"order-platform"/,
    );
    const terraformMain = terraformFiles.find(
      (file) => file.path === "terraform/main.tf",
    );
    assert.match(
      terraformMain?.content ?? "",
      /source\s*=\s*"terraform-aws-modules\/vpc\/aws"[\s\S]*?version\s*=\s*"6\.6\.1"/,
    );
    assert.match(
      terraformMain?.content ?? "",
      /source\s*=\s*"terraform-aws-modules\/eks\/aws"[\s\S]*?version\s*=\s*"21\.24\.0"/,
    );
    const terraformValues = terraformFiles.find(
      (file) => file.path === "terraform/terraform.tfvars.example",
    );
    assert.match(terraformValues?.content ?? "", /^enable_cluster = false$/m);
    assert.match(
      terraformValues?.content ?? "",
      /^aws_region\s*= "us-east-1"$/m,
    );
    const terraformGitignore = terraformFiles.find(
      (file) => file.path === "terraform/.gitignore",
    );
    assert.match(terraformGitignore?.content ?? "", /^\*\.tfvars$/m);
    assert.doesNotMatch(
      terraformGitignore?.content ?? "",
      /^\.terraform\.lock\.hcl$/m,
    );
    assert.match(workflow?.content ?? "", /hashicorp\/setup-terraform@v4/);
    assert.match(workflow?.content ?? "", /terraform fmt -check -recursive/);
    assert.match(
      workflow?.content ?? "",
      /terraform init -backend=false -input=false -no-color/,
    );
    assert.match(workflow?.content ?? "", /terraform validate -no-color/);
    assert.doesNotMatch(
      workflow?.content ?? "",
      /terraform (?:plan|apply|destroy)/,
    );
  }));

test("tool dependencies and saved selections control generated files", () =>
  withServer(async (baseUrl) => {
    const created = await authenticatedFetch(`${baseUrl}/projects`, {
      method: "POST",
      body: JSON.stringify({
        name: "Focused Service",
        architectureType: "monolith",
        visibility: "private",
      }),
    });
    const projectId = ((await created.json()) as { data: { id: string } }).data
      .id;

    const invalidHelm = await authenticatedFetch(
      `${baseUrl}/projects/${projectId}/tool-selections`,
      {
        method: "POST",
        body: JSON.stringify({
          selections: [
            { category: "backend", toolKey: "nodejs", config: {} },
            { category: "packaging", toolKey: "helm", config: {} },
          ],
        }),
      },
    );
    assert.equal(invalidHelm.status, 400);
    assert.equal(
      ((await invalidHelm.json()) as { error: { code: string } }).error.code,
      "TOOL_DEPENDENCY_REQUIRED",
    );

    const invalidTerraform = await authenticatedFetch(
      `${baseUrl}/projects/${projectId}/tool-selections`,
      {
        method: "POST",
        body: JSON.stringify({
          selections: [
            { category: "backend", toolKey: "nodejs", config: {} },
            {
              category: "infrastructure",
              toolKey: "terraform-aws-eks",
              config: {},
            },
          ],
        }),
      },
    );
    assert.equal(invalidTerraform.status, 400);
    const terraformError = (await invalidTerraform.json()) as {
      error: { code: string; details: Record<string, unknown> };
    };
    assert.equal(terraformError.error.code, "TOOL_DEPENDENCY_REQUIRED");
    assert.deepEqual(terraformError.error.details, {
      toolKey: "terraform-aws-eks",
      requiredToolKey: "kubernetes",
    });

    const configured = await authenticatedFetch(
      `${baseUrl}/projects/${projectId}/tool-selections`,
      {
        method: "POST",
        body: JSON.stringify({
          selections: [
            { category: "backend", toolKey: "nodejs", config: {} },
            { category: "ci", toolKey: "github-actions", config: {} },
          ],
        }),
      },
    );
    assert.equal(configured.status, 200);

    const generated = await authenticatedFetch(
      `${baseUrl}/projects/${projectId}/generate`,
      { method: "POST", body: "{}" },
    );
    assert.equal(generated.status, 201);
    const files = (
      (await generated.json()) as {
        data: { files: Array<{ path: string }> };
      }
    ).data.files.map((file) => file.path);
    assert.deepEqual(files, [
      "backend/README.md",
      ".github/workflows/ci.yml",
      ".env.example",
    ]);
    assert.equal(
      files.some((file) => file.startsWith("kubernetes/")),
      false,
    );
    assert.equal(
      files.some((file) => file.startsWith("helm/")),
      false,
    );
    assert.equal(
      files.some((file) => file.startsWith("terraform/")),
      false,
    );
    assert.equal(files.includes("backend/Dockerfile"), false);
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
    await authenticatedFetch(
      `${baseUrl}/projects/${projectId}/tool-selections`,
      {
        method: "POST",
        body: JSON.stringify({
          selections: [
            { category: "backend", toolKey: "nodejs", config: {} },
            { category: "ci", toolKey: "github-actions", config: {} },
          ],
        }),
      },
    );
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
    assert.equal(
      (await published.json()).data.fullName,
      "octocat/order-platform",
    );
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
