import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { GitHubAuthorization } from "@buildsphere/shared-types";
import { ApiError } from "@buildsphere/service-core";

const authorizationEndpoint = "https://github.com/login/oauth/authorize";
const tokenEndpoint = "https://github.com/login/oauth/access_token";
const userEndpoint = "https://api.github.com/user";
const emailsEndpoint = "https://api.github.com/user/emails";
const pkceChallengePattern = /^[A-Za-z0-9_-]{43,128}$/;
const pkceVerifierPattern = /^[A-Za-z0-9._~-]{43,128}$/;

export interface GitHubOAuthConfiguration {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  stateSecret: string;
  tokenEncryptionKey: string;
  apiVersion: string;
  stateTtlSeconds?: number;
}

export interface GitHubUserToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  refreshTokenExpiresIn?: number;
}

export interface GitHubUserProfile {
  id: string;
  login: string;
  name?: string;
  avatarUrl?: string;
}

export interface GitHubEmailAddress {
  email: string;
  verified: boolean;
  primary: boolean;
}

export interface GitHubOAuthClient {
  exchangeCode(code: string, codeVerifier: string): Promise<GitHubUserToken>;
  refreshToken(refreshToken: string): Promise<GitHubUserToken>;
  getUser(accessToken: string): Promise<GitHubUserProfile>;
  getEmails(accessToken: string): Promise<GitHubEmailAddress[]>;
}

export interface StoredGitHubTokens {
  accessTokenEncrypted: string;
  refreshTokenEncrypted?: string;
  accessTokenExpiresAt?: Date;
  refreshTokenExpiresAt?: Date;
}

export interface ActiveGitHubToken {
  accessToken: string;
  replacement?: StoredGitHubTokens;
}

export interface ResolvedGitHubIdentity {
  githubUserId: string;
  login: string;
  name: string;
  email: string;
  avatarUrl?: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted?: string;
  accessTokenExpiresAt?: Date;
  refreshTokenExpiresAt?: Date;
}

interface StatePayload {
  nonce: string;
  codeChallenge: string;
  iat: number;
  exp: number;
}

const encode = (value: string): string =>
  Buffer.from(value).toString("base64url");

const invalidState = (): ApiError =>
  new ApiError(
    400,
    "INVALID_GITHUB_OAUTH_STATE",
    "The GitHub authorization state is invalid or expired",
  );

export class ProviderTokenCipher {
  private readonly key: Buffer;

  constructor(encodedKey: string) {
    this.key = Buffer.from(encodedKey, "base64");
    if (this.key.length !== 32) {
      throw new Error(
        "GITHUB_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
      );
    }
  }

  encrypt(value: string): string {
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, initializationVector);
    const ciphertext = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return [
      "v1",
      initializationVector.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  }

  decrypt(value: string): string {
    const [version, encodedIv, encodedTag, encodedCiphertext] = value.split(".");
    if (
      version !== "v1" ||
      !encodedIv ||
      !encodedTag ||
      !encodedCiphertext
    ) {
      throw new Error("The encrypted provider token is invalid");
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(encodedIv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }
}

export class HttpGitHubOAuthClient implements GitHubOAuthClient {
  constructor(
    private readonly configuration: Pick<
      GitHubOAuthConfiguration,
      "clientId" | "clientSecret" | "callbackUrl" | "apiVersion"
    >,
  ) {}

  async exchangeCode(
    code: string,
    codeVerifier: string,
  ): Promise<GitHubUserToken> {
    const body = new URLSearchParams({
      client_id: this.configuration.clientId,
      client_secret: this.configuration.clientSecret,
      code,
      redirect_uri: this.configuration.callbackUrl,
      code_verifier: codeVerifier,
    });
    const response = await this.request(tokenEndpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const payload = (await response.json().catch(() => undefined)) as
      | {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
          refresh_token_expires_in?: number;
          error?: string;
        }
      | undefined;
    if (!response.ok || !payload?.access_token || payload.error) {
      throw new ApiError(
        401,
        "GITHUB_AUTHORIZATION_FAILED",
        "GitHub did not accept the authorization code",
      );
    }
    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresIn: payload.expires_in,
      refreshTokenExpiresIn: payload.refresh_token_expires_in,
    };
  }

  async refreshToken(refreshToken: string): Promise<GitHubUserToken> {
    const body = new URLSearchParams({
      client_id: this.configuration.clientId,
      client_secret: this.configuration.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    const response = await this.request(tokenEndpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const payload = (await response.json().catch(() => undefined)) as
      | {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
          refresh_token_expires_in?: number;
          error?: string;
        }
      | undefined;
    if (!response.ok || !payload?.access_token || payload.error) {
      throw new ApiError(
        401,
        "GITHUB_REAUTHORIZATION_REQUIRED",
        "Reconnect GitHub to continue",
      );
    }
    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresIn: payload.expires_in,
      refreshTokenExpiresIn: payload.refresh_token_expires_in,
    };
  }

  async getUser(accessToken: string): Promise<GitHubUserProfile> {
    const response = await this.apiRequest(userEndpoint, accessToken);
    const payload = (await response.json().catch(() => undefined)) as
      | {
          id?: number | string;
          login?: string;
          name?: string | null;
          avatar_url?: string | null;
        }
      | undefined;
    if (!response.ok || payload?.id === undefined || !payload.login) {
      throw new ApiError(
        502,
        "GITHUB_PROFILE_UNAVAILABLE",
        "GitHub did not return a valid user profile",
      );
    }
    return {
      id: String(payload.id),
      login: payload.login,
      name: payload.name ?? undefined,
      avatarUrl: payload.avatar_url ?? undefined,
    };
  }

  async getEmails(accessToken: string): Promise<GitHubEmailAddress[]> {
    const response = await this.apiRequest(emailsEndpoint, accessToken);
    const payload = (await response.json().catch(() => undefined)) as
      | Array<{ email?: string; verified?: boolean; primary?: boolean }>
      | undefined;
    if (!response.ok || !Array.isArray(payload)) {
      throw new ApiError(
        502,
        "GITHUB_EMAILS_UNAVAILABLE",
        "GitHub did not return account email addresses",
      );
    }
    return payload
      .filter(
        (item): item is { email: string; verified: boolean; primary: boolean } =>
          typeof item.email === "string" &&
          typeof item.verified === "boolean" &&
          typeof item.primary === "boolean",
      )
      .map((item) => ({ ...item }));
  }

  private apiRequest(url: string, accessToken: string): Promise<Response> {
    return this.request(url, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${accessToken}`,
        "user-agent": "BuildSphere",
        "x-github-api-version": this.configuration.apiVersion,
      },
    });
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ApiError(
        502,
        "GITHUB_UNAVAILABLE",
        "GitHub is currently unavailable",
      );
    }
  }
}

export class GitHubOAuthService {
  private readonly cipher: ProviderTokenCipher;
  private readonly stateTtlSeconds: number;

  constructor(
    private readonly configuration: GitHubOAuthConfiguration,
    private readonly client: GitHubOAuthClient = new HttpGitHubOAuthClient(
      configuration,
    ),
    private readonly now: () => number = Date.now,
  ) {
    if (configuration.stateSecret.length < 32) {
      throw new Error("GITHUB_OAUTH_STATE_SECRET must be at least 32 characters");
    }
    const callbackUrl = new URL(configuration.callbackUrl);
    if (!["http:", "https:"].includes(callbackUrl.protocol)) {
      throw new Error("GITHUB_OAUTH_CALLBACK_URL must use HTTP or HTTPS");
    }
    this.cipher = new ProviderTokenCipher(configuration.tokenEncryptionKey);
    this.stateTtlSeconds = configuration.stateTtlSeconds ?? 600;
  }

  createAuthorization(codeChallenge: string): GitHubAuthorization {
    if (!pkceChallengePattern.test(codeChallenge)) {
      throw new ApiError(
        400,
        "INVALID_GITHUB_PKCE_CHALLENGE",
        "The GitHub PKCE challenge is invalid",
      );
    }
    const now = Math.floor(this.now() / 1_000);
    const payload: StatePayload = {
      nonce: randomBytes(24).toString("base64url"),
      codeChallenge,
      iat: now,
      exp: now + this.stateTtlSeconds,
    };
    const encodedPayload = encode(JSON.stringify(payload));
    const signature = createHmac("sha256", this.configuration.stateSecret)
      .update(encodedPayload)
      .digest("base64url");
    const state = `${encodedPayload}.${signature}`;
    const authorizationUrl = new URL(authorizationEndpoint);
    authorizationUrl.searchParams.set("client_id", this.configuration.clientId);
    authorizationUrl.searchParams.set(
      "redirect_uri",
      this.configuration.callbackUrl,
    );
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("code_challenge", codeChallenge);
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
    return {
      authorizationUrl: authorizationUrl.toString(),
      expiresAt: new Date(payload.exp * 1_000).toISOString(),
    };
  }

  async resolveCallback(
    code: string,
    state: string,
    codeVerifier: string,
  ): Promise<ResolvedGitHubIdentity> {
    this.verifyState(state, codeVerifier);
    const token = await this.client.exchangeCode(code, codeVerifier);
    const [profile, emails] = await Promise.all([
      this.client.getUser(token.accessToken),
      this.client.getEmails(token.accessToken),
    ]);
    const verifiedEmail =
      emails.find((candidate) => candidate.primary && candidate.verified) ??
      emails.find((candidate) => candidate.verified);
    if (!verifiedEmail) {
      throw new ApiError(
        422,
        "GITHUB_VERIFIED_EMAIL_REQUIRED",
        "A verified GitHub email address is required",
      );
    }
    const now = this.now();
    return {
      githubUserId: profile.id,
      login: profile.login,
      name: profile.name?.trim() || profile.login,
      email: verifiedEmail.email.trim().toLowerCase(),
      avatarUrl: profile.avatarUrl,
      accessTokenEncrypted: this.cipher.encrypt(token.accessToken),
      refreshTokenEncrypted: token.refreshToken
        ? this.cipher.encrypt(token.refreshToken)
        : undefined,
      accessTokenExpiresAt: token.expiresIn
        ? new Date(now + token.expiresIn * 1_000)
        : undefined,
      refreshTokenExpiresAt: token.refreshTokenExpiresIn
        ? new Date(now + token.refreshTokenExpiresIn * 1_000)
        : undefined,
    };
  }

  async resolveAccessToken(
    stored: StoredGitHubTokens,
  ): Promise<ActiveGitHubToken> {
    const refreshThreshold = this.now() + 60_000;
    if (
      !stored.accessTokenExpiresAt ||
      stored.accessTokenExpiresAt.getTime() > refreshThreshold
    ) {
      return { accessToken: this.cipher.decrypt(stored.accessTokenEncrypted) };
    }
    if (
      !stored.refreshTokenEncrypted ||
      (stored.refreshTokenExpiresAt &&
        stored.refreshTokenExpiresAt.getTime() <= this.now())
    ) {
      throw new ApiError(
        401,
        "GITHUB_REAUTHORIZATION_REQUIRED",
        "Reconnect GitHub to continue",
      );
    }

    const refreshed = await this.client.refreshToken(
      this.cipher.decrypt(stored.refreshTokenEncrypted),
    );
    const now = this.now();
    return {
      accessToken: refreshed.accessToken,
      replacement: {
        accessTokenEncrypted: this.cipher.encrypt(refreshed.accessToken),
        refreshTokenEncrypted: refreshed.refreshToken
          ? this.cipher.encrypt(refreshed.refreshToken)
          : undefined,
        accessTokenExpiresAt: refreshed.expiresIn
          ? new Date(now + refreshed.expiresIn * 1_000)
          : undefined,
        refreshTokenExpiresAt: refreshed.refreshTokenExpiresIn
          ? new Date(now + refreshed.refreshTokenExpiresIn * 1_000)
          : undefined,
      },
    };
  }

  private verifyState(state: string, codeVerifier: string): void {
    const [encodedPayload, encodedSignature] = state.split(".");
    if (!encodedPayload || !encodedSignature || state.split(".").length !== 2) {
      throw invalidState();
    }
    const expectedSignature = createHmac(
      "sha256",
      this.configuration.stateSecret,
    )
      .update(encodedPayload)
      .digest();
    const receivedSignature = Buffer.from(encodedSignature, "base64url");
    if (
      receivedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      throw invalidState();
    }

    let payload: StatePayload;
    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString("utf8"),
      ) as StatePayload;
    } catch {
      throw invalidState();
    }
    if (
      !payload.nonce ||
      !pkceChallengePattern.test(payload.codeChallenge) ||
      !Number.isInteger(payload.exp) ||
      payload.exp <= this.now() / 1_000
    ) {
      throw invalidState();
    }
    if (!pkceVerifierPattern.test(codeVerifier)) {
      throw new ApiError(
        400,
        "INVALID_GITHUB_PKCE",
        "The GitHub PKCE verifier is invalid",
      );
    }
    const challenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    if (challenge !== payload.codeChallenge) {
      throw new ApiError(
        400,
        "INVALID_GITHUB_PKCE",
        "The GitHub PKCE verifier does not match the authorization request",
      );
    }
  }
}

export const githubOAuthConfigurationFromEnvironment = ():
  | GitHubOAuthConfiguration
  | undefined => {
  const required = {
    clientId: process.env.GITHUB_CLIENT_ID?.trim(),
    clientSecret: process.env.GITHUB_CLIENT_SECRET?.trim(),
    stateSecret: process.env.GITHUB_OAUTH_STATE_SECRET?.trim(),
    tokenEncryptionKey: process.env.GITHUB_TOKEN_ENCRYPTION_KEY?.trim(),
  };
  const configuredValues = Object.values(required).filter(Boolean).length;
  if (configuredValues === 0) return undefined;
  if (configuredValues !== Object.keys(required).length) {
    throw new Error(
      "Set all GitHub OAuth environment variables or leave all of them empty",
    );
  }
  return {
    clientId: required.clientId!,
    clientSecret: required.clientSecret!,
    callbackUrl:
      process.env.GITHUB_OAUTH_CALLBACK_URL?.trim() ||
      "http://localhost:5173/auth/github/callback",
    stateSecret: required.stateSecret!,
    tokenEncryptionKey: required.tokenEncryptionKey!,
    apiVersion: process.env.GITHUB_API_VERSION?.trim() || "2026-03-10",
  };
};
