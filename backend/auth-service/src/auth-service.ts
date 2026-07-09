import type {
  AuthProviderAvailability,
  AuthSession,
  AuthenticatedUser,
  GitHubAuthorization,
  UserSummary,
} from "@buildsphere/shared-types";
import {
  ApiError,
  hashPassword,
  hashToken,
  signToken,
  verifyPassword,
  verifyToken,
} from "@buildsphere/service-core";
import type { AuthRepository, UserRecord } from "./repository.js";
import type { GitHubOAuthService } from "./github-oauth.js";

export interface TokenConfiguration {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
}

const publicUser = ({
  passwordHash: _passwordHash,
  ...user
}: UserRecord): UserSummary => user;

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly tokens: TokenConfiguration,
    private readonly github?: GitHubOAuthService,
  ) {}

  providers(): AuthProviderAvailability {
    return { github: { enabled: Boolean(this.github) } };
  }

  beginGitHubAuthorization(codeChallenge: string): GitHubAuthorization {
    return this.requiredGitHub().createAuthorization(codeChallenge);
  }

  async loginWithGitHub(
    code: string,
    state: string,
    codeVerifier: string,
  ): Promise<AuthSession> {
    const identity = await this.requiredGitHub().resolveCallback(
      code,
      state,
      codeVerifier,
    );
    const existingIdentity =
      await this.repository.findGitHubConnectionByGitHubUserId(
        identity.githubUserId,
      );
    let user = existingIdentity
      ? await this.repository.findUserById(existingIdentity.userId)
      : await this.repository.findUserByEmail(identity.email);
    if (existingIdentity && !user) {
      throw new ApiError(
        500,
        "GITHUB_CONNECTION_INVALID",
        "The GitHub connection is not attached to a valid user",
      );
    }

    if (!user) {
      try {
        user = await this.repository.createUser({
          name: identity.name,
          email: identity.email,
          role: "user",
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        user = await this.repository.findUserByEmail(identity.email);
        if (!user) throw error;
      }
    }

    const userConnection =
      await this.repository.findGitHubConnectionByUserId(user.id);
    if (
      userConnection &&
      userConnection.githubUserId !== identity.githubUserId
    ) {
      throw new ApiError(
        409,
        "GITHUB_CONNECTION_CONFLICT",
        "This BuildSphere account is already connected to another GitHub account",
      );
    }

    const savedConnection = await this.repository.saveGitHubConnection({
      userId: user.id,
      githubUserId: identity.githubUserId,
      login: identity.login,
      avatarUrl: identity.avatarUrl,
      accessTokenEncrypted: identity.accessTokenEncrypted,
      refreshTokenEncrypted: identity.refreshTokenEncrypted,
      accessTokenExpiresAt: identity.accessTokenExpiresAt,
      refreshTokenExpiresAt: identity.refreshTokenExpiresAt,
    });
    if (savedConnection.userId !== user.id) {
      const connectedUser = await this.repository.findUserById(
        savedConnection.userId,
      );
      if (!connectedUser) {
        throw new ApiError(
          500,
          "GITHUB_CONNECTION_INVALID",
          "The GitHub connection is not attached to a valid user",
        );
      }
      user = connectedUser;
    }
    return this.createSession(user);
  }

  async register(
    name: string,
    email: string,
    password: string,
  ): Promise<AuthSession> {
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.repository.findUserByEmail(normalizedEmail)) {
      throw new ApiError(
        409,
        "EMAIL_ALREADY_REGISTERED",
        "An account already exists for this email",
      );
    }

    let user: UserRecord;
    try {
      user = await this.repository.createUser({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: await hashPassword(password),
        role: "user",
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        throw new ApiError(
          409,
          "EMAIL_ALREADY_REGISTERED",
          "An account already exists for this email",
        );
      }
      throw error;
    }
    return this.createSession(user);
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const user = await this.repository.findUserByEmail(
      email.trim().toLowerCase(),
    );
    if (
      !user?.passwordHash ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Email or password is incorrect",
      );
    }
    return this.createSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const payload = verifyToken(
      refreshToken,
      this.tokens.refreshSecret,
      "refresh",
    );
    if (
      !(await this.repository.isRefreshTokenActive(
        hashToken(refreshToken),
        payload.sub,
      ))
    ) {
      throw new ApiError(
        401,
        "INVALID_REFRESH_TOKEN",
        "The refresh token is invalid or revoked",
      );
    }

    await this.repository.revokeRefreshToken(hashToken(refreshToken));
    const user = await this.repository.findUserById(payload.sub);
    if (!user)
      throw new ApiError(
        401,
        "INVALID_REFRESH_TOKEN",
        "The token user no longer exists",
      );
    return this.createSession(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.repository.revokeRefreshToken(hashToken(refreshToken));
  }

  async getUser(userId: string): Promise<UserSummary> {
    const user = await this.repository.findUserById(userId);
    if (!user)
      throw new ApiError(
        404,
        "USER_NOT_FOUND",
        "The authenticated user was not found",
      );
    return publicUser(user);
  }

  private async createSession(user: UserRecord): Promise<AuthSession> {
    const identity: AuthenticatedUser = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = signToken(
      identity,
      this.tokens.accessSecret,
      "access",
      this.tokens.accessTtl,
    );
    const refreshToken = signToken(
      identity,
      this.tokens.refreshSecret,
      "refresh",
      this.tokens.refreshTtl,
    );
    const refreshClaims = verifyToken(
      refreshToken,
      this.tokens.refreshSecret,
      "refresh",
    );
    await this.repository.saveRefreshToken(
      hashToken(refreshToken),
      user.id,
      new Date(refreshClaims.exp * 1_000),
    );
    return { user: publicUser(user), accessToken, refreshToken };
  }

  private requiredGitHub(): GitHubOAuthService {
    if (!this.github) {
      throw new ApiError(
        503,
        "GITHUB_AUTH_NOT_CONFIGURED",
        "GitHub authentication is not configured",
      );
    }
    return this.github;
  }
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "23505";
