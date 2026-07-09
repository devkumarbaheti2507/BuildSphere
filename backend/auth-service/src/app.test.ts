import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { createAuthApp } from "./app.js";
import type {
  CreateGitHubRepository,
  GitHubApiClient,
} from "./github-api.js";
import { GitHubIntegrationService } from "./github-integration.js";
import {
  GitHubOAuthService,
  type GitHubOAuthClient,
} from "./github-oauth.js";
import {
  InMemoryAuthRepository,
  type AuthRepository,
} from "./repository.js";

const tokens = {
  accessSecret: "access-secret-for-tests-only",
  refreshSecret: "refresh-secret-for-tests-only",
  accessTtl: "15m",
  refreshTtl: "7d",
};

const withServer = async (
  run: (baseUrl: string) => Promise<void>,
  options: {
    repository?: AuthRepository;
    github?: GitHubOAuthService;
    integration?: GitHubIntegrationService;
    internalToken?: string;
  } = {},
) => {
  const server = createAuthApp(
    options.repository ?? new InMemoryAuthRepository(),
    tokens,
    undefined,
    options.github,
    options.integration,
    options.internalToken,
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

const githubVerifier = "browser-verifier".padEnd(64, "x");
const githubChallenge = createHash("sha256")
  .update(githubVerifier)
  .digest("base64url");

class AppTestGitHubClient implements GitHubOAuthClient {
  email = "github@example.com";
  githubUserId = "98765";

  async exchangeCode() {
    return { accessToken: "github-access-token" };
  }

  async refreshToken() {
    return { accessToken: "refreshed-github-access-token" };
  }

  async getUser() {
    return {
      id: this.githubUserId,
      login: "github-user",
      name: "GitHub User",
    };
  }

  async getEmails() {
    return [{ email: this.email, verified: true, primary: true }];
  }
}

class AppTestGitHubApi implements GitHubApiClient {
  async createRepository(_token: string, input: CreateGitHubRepository) {
    return {
      id: "456",
      ownerLogin: "github-user",
      name: input.name,
      fullName: `github-user/${input.name}`,
      private: input.private,
      defaultBranch: "main",
      htmlUrl: `https://github.com/github-user/${input.name}`,
    };
  }

  async getContentSha() {
    return undefined;
  }

  async putFile() {}

  async listWorkflowRuns() {
    return [
      {
        id: "9001",
        name: "Build",
        status: "completed",
        conclusion: "success",
        branch: "main",
        headSha: "abc123",
        runNumber: 1,
        event: "push",
        htmlUrl: "https://github.com/github-user/project/actions/runs/9001",
        createdAt: "2026-07-09T12:00:00.000Z",
        updatedAt: "2026-07-09T12:05:00.000Z",
      },
    ];
  }
}

const githubService = (client: GitHubOAuthClient) =>
  new GitHubOAuthService(
    {
      clientId: "github-client-id",
      clientSecret: "github-client-secret",
      callbackUrl: "http://localhost:5173/auth/github/callback",
      stateSecret: "github-state-secret-for-tests-only-1234567890",
      tokenEncryptionKey: Buffer.alloc(32, 9).toString("base64"),
      apiVersion: "2026-03-10",
    },
    client,
  );

const beginGitHubAuthorization = async (baseUrl: string): Promise<string> => {
  const response = await fetch(`${baseUrl}/auth/github/authorize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ codeChallenge: githubChallenge }),
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    data: { authorizationUrl: string };
  };
  return new URL(body.data.authorizationUrl).searchParams.get("state")!;
};

const completeGitHubAuthorization = (
  baseUrl: string,
  state: string,
): Promise<Response> =>
  fetch(`${baseUrl}/auth/github/callback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code: "temporary-code",
      state,
      codeVerifier: githubVerifier,
    }),
  });

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

test("GitHub provider availability is public and disabled deterministically", () =>
  withServer(async (baseUrl) => {
    const providers = await fetch(`${baseUrl}/auth/providers`);
    assert.deepEqual((await providers.json()).data, {
      github: { enabled: false },
    });

    const authorization = await fetch(`${baseUrl}/auth/github/authorize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ codeChallenge: githubChallenge }),
    });
    assert.equal(authorization.status, 503);
    assert.equal(
      ((await authorization.json()) as { error: { code: string } }).error.code,
      "GITHUB_AUTH_NOT_CONFIGURED",
    );
  }));

test("GitHub callback creates a provider-only user and BuildSphere session", () => {
  const repository = new InMemoryAuthRepository();
  const client = new AppTestGitHubClient();
  return withServer(
    async (baseUrl) => {
      const providers = await fetch(`${baseUrl}/auth/providers`);
      assert.equal((await providers.json()).data.github.enabled, true);
      const state = await beginGitHubAuthorization(baseUrl);
      const callback = await completeGitHubAuthorization(baseUrl, state);
      assert.equal(callback.status, 200);
      const callbackBody = (await callback.json()) as {
        data: { accessToken: string; user: { id: string; email: string } };
      };
      assert.equal(callbackBody.data.user.email, "github@example.com");

      const connection = await repository.findGitHubConnectionByUserId(
        callbackBody.data.user.id,
      );
      assert.equal(connection?.githubUserId, "98765");
      assert.ok(!connection?.accessTokenEncrypted.includes("github-access-token"));

      const passwordLogin = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "github@example.com",
          password: "StrongPassword123",
        }),
      });
      assert.equal(passwordLogin.status, 401);
    },
    { repository, github: githubService(client) },
  );
});

test("GitHub callback links an existing user by verified email", () => {
  const repository = new InMemoryAuthRepository();
  const client = new AppTestGitHubClient();
  client.email = "existing@example.com";
  return withServer(
    async (baseUrl) => {
      const registration = await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Existing User",
          email: "existing@example.com",
          password: "StrongPassword123",
        }),
      });
      const registeredUser = (await registration.json()).data.user as {
        id: string;
      };
      const state = await beginGitHubAuthorization(baseUrl);
      const callback = await completeGitHubAuthorization(baseUrl, state);
      const githubUser = (await callback.json()).data.user as { id: string };

      assert.equal(callback.status, 200);
      assert.equal(githubUser.id, registeredUser.id);
      assert.equal(
        (await repository.findGitHubConnectionByUserId(registeredUser.id))
          ?.githubUserId,
        "98765",
      );
    },
    { repository, github: githubService(client) },
  );
});

test("internal GitHub endpoints require service auth and publish project data", () => {
  const repository = new InMemoryAuthRepository();
  const client = new AppTestGitHubClient();
  const oauth = githubService(client);
  const integration = new GitHubIntegrationService(
    repository,
    oauth,
    new AppTestGitHubApi(),
  );
  return withServer(
    async (baseUrl) => {
      const state = await beginGitHubAuthorization(baseUrl);
      const callback = await completeGitHubAuthorization(baseUrl, state);
      const userId = ((await callback.json()) as { data: { user: { id: string } } })
        .data.user.id;
      const input = {
        userId,
        projectId: "70bcb026-0ec2-4b85-a826-23d738420d04",
        name: "published-project",
        private: true,
        files: [
          {
            path: "README.md",
            content: "# Published",
            language: "markdown",
            explanation: "Project documentation",
          },
        ],
      };
      const unauthorized = await fetch(
        `${baseUrl}/internal/github/repositories`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      assert.equal(unauthorized.status, 401);

      const published = await fetch(
        `${baseUrl}/internal/github/repositories`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-internal-service-token": "internal-test-token",
          },
          body: JSON.stringify(input),
        },
      );
      assert.equal(published.status, 201);
      assert.equal(
        ((await published.json()) as { data: { fullName: string } }).data
          .fullName,
        "github-user/published-project",
      );

      const synchronized = await fetch(
        `${baseUrl}/internal/github/projects/${input.projectId}/actions/sync`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-internal-service-token": "internal-test-token",
          },
          body: JSON.stringify({ userId }),
        },
      );
      assert.equal(synchronized.status, 200);
      assert.equal(
        ((await synchronized.json()) as { data: Array<{ status: string }> })
          .data[0].status,
        "succeeded",
      );
    },
    {
      repository,
      github: oauth,
      integration,
      internalToken: "internal-test-token",
    },
  );
});
