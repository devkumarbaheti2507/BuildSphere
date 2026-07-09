import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLogger,
  loadEnvironment,
  registerGracefulShutdown,
  requiredEnvironment,
} from "@buildsphere/service-core";
import { createAuthApp } from "./app.js";
import { HttpGitHubApiClient } from "./github-api.js";
import { GitHubIntegrationService } from "./github-integration.js";
import {
  githubOAuthConfigurationFromEnvironment,
  GitHubOAuthService,
} from "./github-oauth.js";
import {
  InMemoryAuthRepository,
  PostgresAuthRepository,
} from "./repository.js";

const serviceName = process.env.SERVICE_NAME ?? "auth-service";
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
loadEnvironment(path.join(repoRoot, ".env"));

const port = Number(process.env.PORT ?? 8081);
const logger = createLogger(serviceName);
const database =
  process.env.STORAGE_DRIVER === "memory"
    ? undefined
    : (await import("@buildsphere/service-core/database")).createDatabasePool();
const repository = database
  ? new PostgresAuthRepository(database)
  : new InMemoryAuthRepository();
const githubConfiguration = githubOAuthConfigurationFromEnvironment();
const githubOAuth = githubConfiguration
  ? new GitHubOAuthService(githubConfiguration)
  : undefined;
const app = createAuthApp(
  repository,
  {
    accessSecret: requiredEnvironment("JWT_ACCESS_TOKEN_SECRET"),
    refreshSecret: requiredEnvironment("JWT_REFRESH_TOKEN_SECRET"),
    accessTtl: process.env.JWT_ACCESS_TOKEN_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TOKEN_TTL ?? "7d",
  },
  logger,
  githubOAuth,
  githubOAuth && githubConfiguration
    ? new GitHubIntegrationService(
        repository,
        githubOAuth,
        new HttpGitHubApiClient(githubConfiguration.apiVersion),
      )
    : undefined,
  requiredEnvironment("INTERNAL_SERVICE_TOKEN"),
);

const server = app.listen(port, () =>
  logger.info({ port }, "Auth service listening"),
);

registerGracefulShutdown(server, database ? [database] : [], (error) =>
  logger.error({ err: error }, "Graceful shutdown failed"),
);
