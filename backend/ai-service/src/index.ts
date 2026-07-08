import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLogger,
  HttpNotificationPublisher,
  loadEnvironment,
  registerGracefulShutdown,
  requiredEnvironment,
} from "@buildsphere/service-core";
import { createAiApp } from "./app.js";
import { MockSuggestionAnalyzer, RuleSuggestionAnalyzer } from "./analyzer.js";
import {
  InMemorySuggestionRepository,
  PostgresSuggestionRepository,
} from "./repository.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
loadEnvironment(path.join(repoRoot, ".env"));
const port = Number(process.env.PORT ?? 8087);
const logger = createLogger(process.env.SERVICE_NAME ?? "ai-service");
const database =
  process.env.STORAGE_DRIVER === "memory"
    ? undefined
    : (await import("@buildsphere/service-core/database")).createDatabasePool();
const notifications = new HttpNotificationPublisher(
  process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:8089",
  requiredEnvironment("INTERNAL_SERVICE_TOKEN"),
  logger,
);
const analyzer =
  process.env.AI_PROVIDER === "mock"
    ? new MockSuggestionAnalyzer()
    : new RuleSuggestionAnalyzer();
const app = createAiApp(
  database
    ? new PostgresSuggestionRepository(database)
    : new InMemorySuggestionRepository(),
  repoRoot,
  requiredEnvironment("JWT_ACCESS_TOKEN_SECRET"),
  logger,
  notifications,
  analyzer,
);
const server = app.listen(port, () =>
  logger.info({ port }, "AI service listening"),
);
registerGracefulShutdown(server, database ? [database] : [], (error) =>
  logger.error({ err: error }, "Graceful shutdown failed"),
);
