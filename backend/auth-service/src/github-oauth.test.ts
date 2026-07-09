import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { ApiError } from "@buildsphere/service-core";
import {
  GitHubOAuthService,
  ProviderTokenCipher,
  githubOAuthConfigurationFromEnvironment,
  type GitHubOAuthClient,
  type GitHubOAuthConfiguration,
} from "./github-oauth.js";

const encryptionKey = Buffer.alloc(32, 7).toString("base64");
const configuration: GitHubOAuthConfiguration = {
  clientId: "github-client-id",
  clientSecret: "github-client-secret",
  callbackUrl: "http://localhost:5173/auth/github/callback",
  stateSecret: "github-state-secret-for-tests-only-1234567890",
  tokenEncryptionKey: encryptionKey,
  apiVersion: "2026-03-10",
};
const verifier = "test-verifier-".padEnd(64, "x");
const challenge = createHash("sha256").update(verifier).digest("base64url");

class FakeGitHubClient implements GitHubOAuthClient {
  exchangeCalls = 0;
  refreshCalls = 0;
  emails = [
    { email: "octocat@example.com", verified: true, primary: true },
  ];

  async exchangeCode() {
    this.exchangeCalls += 1;
    return {
      accessToken: "github-access-token",
      refreshToken: "github-refresh-token",
      expiresIn: 28_800,
      refreshTokenExpiresIn: 15_897_600,
    };
  }

  async refreshToken() {
    this.refreshCalls += 1;
    return {
      accessToken: "refreshed-github-access-token",
      refreshToken: "refreshed-github-refresh-token",
      expiresIn: 28_800,
      refreshTokenExpiresIn: 15_897_600,
    };
  }

  async getUser() {
    return {
      id: "12345",
      login: "octocat",
      name: "Mona Lisa",
      avatarUrl: "https://avatars.githubusercontent.com/u/12345",
    };
  }

  async getEmails() {
    return this.emails;
  }
}

test("GitHub OAuth signs state, binds PKCE, and encrypts provider tokens", async () => {
  const client = new FakeGitHubClient();
  const now = Date.UTC(2026, 6, 9, 12);
  const service = new GitHubOAuthService(configuration, client, () => now);
  const authorization = service.createAuthorization(challenge);
  const authorizationUrl = new URL(authorization.authorizationUrl);

  assert.equal(authorizationUrl.origin, "https://github.com");
  assert.equal(authorizationUrl.searchParams.get("client_id"), "github-client-id");
  assert.equal(authorizationUrl.searchParams.get("code_challenge"), challenge);
  assert.equal(
    authorizationUrl.searchParams.get("code_challenge_method"),
    "S256",
  );

  const identity = await service.resolveCallback(
    "temporary-code",
    authorizationUrl.searchParams.get("state")!,
    verifier,
  );
  const cipher = new ProviderTokenCipher(encryptionKey);

  assert.equal(identity.githubUserId, "12345");
  assert.equal(identity.email, "octocat@example.com");
  assert.equal(cipher.decrypt(identity.accessTokenEncrypted), "github-access-token");
  assert.equal(
    cipher.decrypt(identity.refreshTokenEncrypted!),
    "github-refresh-token",
  );
  assert.ok(!identity.accessTokenEncrypted.includes("github-access-token"));
  assert.equal(identity.accessTokenExpiresAt?.toISOString(), "2026-07-09T20:00:00.000Z");
});

test("GitHub OAuth rejects tampered, expired, and mismatched state before exchange", async () => {
  let now = Date.UTC(2026, 6, 9, 12);
  const client = new FakeGitHubClient();
  const service = new GitHubOAuthService(configuration, client, () => now);
  const state = new URL(service.createAuthorization(challenge).authorizationUrl)
    .searchParams.get("state")!;

  await assert.rejects(
    service.resolveCallback("code", `${state}x`, verifier),
    (error: unknown) =>
      error instanceof ApiError && error.code === "INVALID_GITHUB_OAUTH_STATE",
  );
  await assert.rejects(
    service.resolveCallback("code", state, "different-verifier".padEnd(64, "x")),
    (error: unknown) =>
      error instanceof ApiError && error.code === "INVALID_GITHUB_PKCE",
  );
  now += 601_000;
  await assert.rejects(
    service.resolveCallback("code", state, verifier),
    (error: unknown) =>
      error instanceof ApiError && error.code === "INVALID_GITHUB_OAUTH_STATE",
  );
  assert.equal(client.exchangeCalls, 0);
});

test("GitHub OAuth requires a verified account email", async () => {
  const client = new FakeGitHubClient();
  client.emails = [
    { email: "unverified@example.com", verified: false, primary: true },
  ];
  const service = new GitHubOAuthService(configuration, client);
  const state = new URL(service.createAuthorization(challenge).authorizationUrl)
    .searchParams.get("state")!;

  await assert.rejects(
    service.resolveCallback("code", state, verifier),
    (error: unknown) =>
      error instanceof ApiError &&
      error.code === "GITHUB_VERIFIED_EMAIL_REQUIRED",
  );
});

test("GitHub OAuth remains disabled when only optional defaults are configured", () => {
  const keys = [
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GITHUB_OAUTH_CALLBACK_URL",
    "GITHUB_OAUTH_STATE_SECRET",
    "GITHUB_TOKEN_ENCRYPTION_KEY",
  ] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );

  try {
    for (const key of keys) delete process.env[key];
    process.env.GITHUB_OAUTH_CALLBACK_URL =
      "http://localhost:5173/auth/github/callback";

    assert.equal(githubOAuthConfigurationFromEnvironment(), undefined);
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("GitHub OAuth refreshes expiring provider tokens and rotates encryption", async () => {
  const client = new FakeGitHubClient();
  const now = Date.UTC(2026, 6, 9, 12);
  const service = new GitHubOAuthService(configuration, client, () => now);
  const cipher = new ProviderTokenCipher(encryptionKey);
  const active = await service.resolveAccessToken({
    accessTokenEncrypted: cipher.encrypt("expired-access-token"),
    refreshTokenEncrypted: cipher.encrypt("current-refresh-token"),
    accessTokenExpiresAt: new Date(now + 30_000),
    refreshTokenExpiresAt: new Date(now + 3_600_000),
  });

  assert.equal(active.accessToken, "refreshed-github-access-token");
  assert.equal(client.refreshCalls, 1);
  assert.equal(
    cipher.decrypt(active.replacement!.refreshTokenEncrypted!),
    "refreshed-github-refresh-token",
  );
});

test("GitHub OAuth requires reauthorization when an expired token cannot refresh", async () => {
  const now = Date.UTC(2026, 6, 9, 12);
  const service = new GitHubOAuthService(
    configuration,
    new FakeGitHubClient(),
    () => now,
  );
  const cipher = new ProviderTokenCipher(encryptionKey);

  await assert.rejects(
    service.resolveAccessToken({
      accessTokenEncrypted: cipher.encrypt("expired-access-token"),
      accessTokenExpiresAt: new Date(now - 1),
    }),
    (error: unknown) =>
      error instanceof ApiError &&
      error.code === "GITHUB_REAUTHORIZATION_REQUIRED",
  );
});
