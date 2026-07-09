import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { ApiError } from "@buildsphere/service-core";
import type {
  CreateGitHubRepository,
  GitHubApiClient,
  GitHubApiWorkflowRun,
} from "./github-api.js";
import { GitHubIntegrationService } from "./github-integration.js";
import {
  GitHubOAuthService,
  ProviderTokenCipher,
  type GitHubOAuthClient,
} from "./github-oauth.js";
import { InMemoryAuthRepository } from "./repository.js";

const encryptionKey = Buffer.alloc(32, 3).toString("base64");
const now = Date.UTC(2026, 6, 9, 12);

class IntegrationOAuthClient implements GitHubOAuthClient {
  async exchangeCode() {
    return { accessToken: "unused" };
  }

  async refreshToken() {
    return {
      accessToken: "rotated-access-token",
      refreshToken: "rotated-refresh-token",
      expiresIn: 28_800,
      refreshTokenExpiresIn: 15_897_600,
    };
  }

  async getUser() {
    return { id: "1", login: "octocat" };
  }

  async getEmails() {
    return [{ email: "octocat@example.com", verified: true, primary: true }];
  }
}

class IntegrationGitHubApi implements GitHubApiClient {
  createCalls = 0;
  fileWrites: string[] = [];
  failPath?: string;
  existingFiles = new Map<string, string>();
  workflowRuns: GitHubApiWorkflowRun[] = [];

  async createRepository(_token: string, input: CreateGitHubRepository) {
    this.createCalls += 1;
    return {
      id: "456",
      ownerLogin: "octocat",
      name: input.name,
      fullName: `octocat/${input.name}`,
      private: input.private,
      defaultBranch: "main",
      htmlUrl: `https://github.com/octocat/${input.name}`,
    };
  }

  async getContentSha(
    _token: string,
    _owner: string,
    _repository: string,
    path: string,
  ) {
    return this.existingFiles.get(path);
  }

  async putFile(
    _token: string,
    _owner: string,
    _repository: string,
    path: string,
    _content: string,
  ) {
    this.fileWrites.push(path);
    if (path === this.failPath) {
      throw new ApiError(502, "GITHUB_PROVIDER_ERROR", "Provider failed");
    }
    this.existingFiles.set(path, `sha-${path}`);
  }

  async listWorkflowRuns() {
    return this.workflowRuns;
  }
}

const setup = async (expiring = false) => {
  const repository = new InMemoryAuthRepository();
  const user = await repository.createUser({
    name: "Octo Cat",
    email: "octocat@example.com",
    role: "user",
  });
  const cipher = new ProviderTokenCipher(encryptionKey);
  await repository.saveGitHubConnection({
    userId: user.id,
    githubUserId: "123",
    login: "octocat",
    accessTokenEncrypted: cipher.encrypt("stored-access-token"),
    refreshTokenEncrypted: cipher.encrypt("stored-refresh-token"),
    accessTokenExpiresAt: expiring
      ? new Date(now + 30_000)
      : new Date(now + 3_600_000),
    refreshTokenExpiresAt: new Date(now + 86_400_000),
  });
  const oauth = new GitHubOAuthService(
    {
      clientId: "client-id",
      clientSecret: "client-secret",
      callbackUrl: "http://localhost:5173/auth/github/callback",
      stateSecret: "github-state-secret-for-tests-only-1234567890",
      tokenEncryptionKey: encryptionKey,
      apiVersion: "2026-03-10",
    },
    new IntegrationOAuthClient(),
    () => now,
  );
  const github = new IntegrationGitHubApi();
  const service = new GitHubIntegrationService(
    repository,
    oauth,
    github,
    () => now,
  );
  return { repository, user, github, service, cipher };
};

const generatedFiles = [
  {
    path: "src/index.ts",
    content: "export {};",
    language: "typescript",
    explanation: "Application entry point",
  },
  {
    path: "README.md",
    content: "# Example",
    language: "markdown",
    explanation: "Project documentation",
  },
];

const blobSha = (content: string) => {
  const bytes = Buffer.from(content, "utf8");
  return createHash("sha1")
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
};

test("repository publishing is serial, durable, and retry-safe", async () => {
  const { repository, user, github, service } = await setup();
  github.failPath = "src/index.ts";

  await assert.rejects(
    service.publishRepository({
      userId: user.id,
      projectId: "9df4479a-56a9-4650-a53b-2f091de483c5",
      name: "example-project",
      private: true,
      files: generatedFiles,
    }),
    (error: unknown) =>
      error instanceof ApiError && error.code === "GITHUB_PROVIDER_ERROR",
  );
  const partial = await repository.findProjectGitHubRepository(
    "9df4479a-56a9-4650-a53b-2f091de483c5",
  );
  assert.equal(partial?.githubRepositoryId, "456");
  assert.equal(partial?.publishedFiles, 0);

  github.failPath = undefined;
  github.fileWrites = [];
  const published = await service.publishRepository({
    userId: user.id,
    projectId: "9df4479a-56a9-4650-a53b-2f091de483c5",
    name: "ignored-on-retry",
    private: false,
    files: generatedFiles,
  });

  assert.equal(github.createCalls, 1);
  assert.deepEqual(github.fileWrites, ["README.md", "src/index.ts"]);
  assert.equal(published.fullName, "octocat/example-project");
  assert.equal(published.publishedFiles, 2);
  assert.equal(published.lastPublishedAt, "2026-07-09T12:00:00.000Z");
});

test("repository publishing persists rotated provider tokens", async () => {
  const { repository, user, service, cipher } = await setup(true);
  await service.publishRepository({
    userId: user.id,
    projectId: "6ade85b4-2d8d-4f36-aaec-c29240676645",
    name: "token-refresh-project",
    private: false,
    files: generatedFiles,
  });

  const connection = await repository.findGitHubConnectionByUserId(user.id);
  assert.equal(
    cipher.decrypt(connection!.accessTokenEncrypted),
    "rotated-access-token",
  );
  assert.equal(
    cipher.decrypt(connection!.refreshTokenEncrypted!),
    "rotated-refresh-token",
  );
});

test("repository publishing writes workflow files last", async () => {
  const { user, github, service } = await setup();
  await service.publishRepository({
    userId: user.id,
    projectId: "ae70519f-d9fc-4742-a2cb-c52bd4db6715",
    name: "workflow-order-project",
    private: true,
    files: [
      {
        ...generatedFiles[0],
        path: ".github/workflows/ci.yml",
        language: "yaml",
      },
      ...generatedFiles,
    ],
  });

  assert.deepEqual(github.fileWrites, [
    "README.md",
    "src/index.ts",
    ".github/workflows/ci.yml",
  ]);
});

test("repository publishing skips unchanged Git blobs", async () => {
  const { user, github, service } = await setup();
  const projectId = "ec227b17-1e9d-43ec-9b6e-ae3aa08198bc";
  await service.publishRepository({
    userId: user.id,
    projectId,
    name: "unchanged-project",
    private: true,
    files: generatedFiles,
  });

  github.fileWrites = [];
  github.existingFiles.set("README.md", blobSha("# Example"));
  github.existingFiles.set("src/index.ts", blobSha("export {};"));
  await service.publishRepository({
    userId: user.id,
    projectId,
    name: "unchanged-project",
    private: true,
    files: generatedFiles,
  });

  assert.deepEqual(github.fileWrites, []);
});

test("workflow synchronization normalizes and upserts GitHub runs", async () => {
  const { user, github, service } = await setup();
  const projectId = "47a0a255-04ea-4c17-8e3f-dd3d08c045f8";
  await service.publishRepository({
    userId: user.id,
    projectId,
    name: "actions-project",
    private: false,
    files: generatedFiles,
  });
  github.workflowRuns = [
    {
      id: "9001",
      name: "Build",
      status: "queued",
      branch: "main",
      headSha: "abc123",
      runNumber: 7,
      event: "push",
      htmlUrl: "https://github.com/octocat/actions-project/actions/runs/9001",
      createdAt: "2026-07-09T11:00:00.000Z",
      updatedAt: "2026-07-09T11:00:00.000Z",
    },
  ];
  assert.equal((await service.synchronizeWorkflowRuns(user.id, projectId))[0].status, "queued");

  github.workflowRuns[0] = {
    ...github.workflowRuns[0],
    status: "completed",
    conclusion: "success",
    updatedAt: "2026-07-09T11:05:00.000Z",
  };
  const synchronized = await service.synchronizeWorkflowRuns(
    user.id,
    projectId,
  );

  assert.equal(synchronized.length, 1);
  assert.equal(synchronized[0].status, "succeeded");
  assert.equal(synchronized[0].conclusion, "success");
});

test("repository publishing rejects unsafe paths before provider calls", async () => {
  const { user, github, service } = await setup();
  await assert.rejects(
    service.publishRepository({
      userId: user.id,
      projectId: "8c5ab153-b2b7-4480-bcce-e7634230b40c",
      name: "unsafe-project",
      private: true,
      files: [{ ...generatedFiles[0], path: "../secret.txt" }],
    }),
    (error: unknown) =>
      error instanceof ApiError && error.code === "INVALID_GITHUB_FILE_PATH",
  );
  assert.equal(github.createCalls, 0);
});
