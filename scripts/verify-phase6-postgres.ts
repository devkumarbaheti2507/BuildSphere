import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  createDatabasePool,
  type DatabasePool,
} from "@buildsphere/service-core/database";
import { loadEnvironment } from "@buildsphere/service-core";
import type {
  CreateGitHubRepository,
  GitHubApiClient,
} from "../backend/auth-service/src/github-api.js";
import { GitHubIntegrationService } from "../backend/auth-service/src/github-integration.js";
import {
  GitHubOAuthService,
  ProviderTokenCipher,
  type GitHubOAuthClient,
} from "../backend/auth-service/src/github-oauth.js";
import { PostgresAuthRepository } from "../backend/auth-service/src/repository.js";

const repoRoot = process.env.INIT_CWD ?? path.resolve(process.cwd(), "../..");
loadEnvironment(path.join(repoRoot, ".env"));

class VerificationOAuthClient implements GitHubOAuthClient {
  refreshCalls = 0;

  async exchangeCode() {
    return { accessToken: "unused" };
  }

  async refreshToken() {
    this.refreshCalls += 1;
    return {
      accessToken: "phase6-rotated-access-token",
      refreshToken: "phase6-rotated-refresh-token",
      expiresIn: 28_800,
      refreshTokenExpiresIn: 15_897_600,
    };
  }

  async getUser() {
    return { id: "phase6-verification", login: "phase6-verification" };
  }

  async getEmails() {
    return [
      {
        email: "phase6-verification@example.com",
        verified: true,
        primary: true,
      },
    ];
  }
}

class VerificationGitHubApi implements GitHubApiClient {
  fileWrites = 0;

  async createRepository(_token: string, input: CreateGitHubRepository) {
    return {
      id: "987654321",
      ownerLogin: "buildsphere-verification",
      name: input.name,
      fullName: `buildsphere-verification/${input.name}`,
      private: input.private,
      defaultBranch: "main",
      htmlUrl: `https://github.com/buildsphere-verification/${input.name}`,
    };
  }

  async getContentSha() {
    return undefined;
  }

  async putFile() {
    this.fileWrites += 1;
  }

  async listWorkflowRuns() {
    return [
      {
        id: "123456789",
        name: "BuildSphere verification",
        status: "completed",
        conclusion: "success",
        branch: "main",
        headSha: "abcdef1234567890",
        runNumber: 1,
        event: "push",
        htmlUrl:
          "https://github.com/buildsphere-verification/phase6-verification/actions/runs/123456789",
        createdAt: "2026-07-09T12:00:00.000Z",
        updatedAt: "2026-07-09T12:05:00.000Z",
      },
    ];
  }
}

const verify = async (database: DatabasePool): Promise<void> => {
  const repository = new PostgresAuthRepository(database);
  const user = await repository.createUser({
    name: "Phase 6 PostgreSQL Verification",
    email: `phase6-${randomUUID()}@example.com`,
    role: "user",
  });
  try {
    const encryptionKey = Buffer.alloc(32, 11).toString("base64");
    const cipher = new ProviderTokenCipher(encryptionKey);
    await repository.saveGitHubConnection({
      userId: user.id,
      githubUserId: `verification-${randomUUID()}`,
      login: "buildsphere-verification",
      accessTokenEncrypted: cipher.encrypt("phase6-expired-access-token"),
      refreshTokenEncrypted: cipher.encrypt("phase6-refresh-token"),
      accessTokenExpiresAt: new Date(Date.now() - 1_000),
      refreshTokenExpiresAt: new Date(Date.now() + 86_400_000),
    });

    const oauthClient = new VerificationOAuthClient();
    const githubApi = new VerificationGitHubApi();
    const oauth = new GitHubOAuthService(
      {
        clientId: "verification-client",
        clientSecret: "verification-secret",
        callbackUrl: "http://localhost:5173/auth/github/callback",
        stateSecret: "phase6-verification-state-secret-1234567890",
        tokenEncryptionKey: encryptionKey,
        apiVersion: "2026-03-10",
      },
      oauthClient,
    );
    const integration = new GitHubIntegrationService(
      repository,
      oauth,
      githubApi,
    );
    const projectId = randomUUID();
    const published = await integration.publishRepository({
      userId: user.id,
      projectId,
      name: "phase6-verification",
      private: true,
      files: [
        {
          path: "README.md",
          content: "# Phase 6 PostgreSQL verification",
          language: "markdown",
          explanation: "Durable integration verification file",
        },
      ],
    });
    const runs = await integration.synchronizeWorkflowRuns(user.id, projectId);
    const connection = await repository.findGitHubConnectionByUserId(user.id);

    assert.equal(published.publishedFiles, 1);
    assert.equal(githubApi.fileWrites, 1);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, "succeeded");
    assert.equal(oauthClient.refreshCalls, 1);
    assert.equal(
      cipher.decrypt(connection!.accessTokenEncrypted),
      "phase6-rotated-access-token",
    );

    const counts = await database.query<{
      repositories: string;
      runs: string;
    }>(
      `SELECT
         (SELECT count(*) FROM project_github_repositories WHERE project_id = $1)::text AS repositories,
         (SELECT count(*) FROM github_workflow_runs WHERE project_id = $1)::text AS runs`,
      [projectId],
    );
    assert.deepEqual(counts.rows[0], { repositories: "1", runs: "1" });
    console.log(
      JSON.stringify(
        {
          status: "passed",
          repositoryRows: Number(counts.rows[0].repositories),
          workflowRunRows: Number(counts.rows[0].runs),
          tokenRefreshes: oauthClient.refreshCalls,
          publishedFiles: published.publishedFiles,
        },
        null,
        2,
      ),
    );
  } finally {
    await database.query("DELETE FROM users WHERE id = $1", [user.id]);
  }
};

const main = async (): Promise<void> => {
  const database = createDatabasePool();
  try {
    await verify(database);
  } finally {
    await database.end();
  }
};

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
