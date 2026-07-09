import { randomUUID } from "node:crypto";
import type {
  GitHubRepositorySummary,
  GitHubWorkflowRun,
  PipelineExecutionStatus,
  UserRole,
  UserSummary,
} from "@buildsphere/shared-types";
import type { DatabasePool } from "@buildsphere/service-core/database";

export interface UserRecord extends UserSummary {
  passwordHash?: string;
}

export interface CreateUserRecord {
  name: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
}

export interface GitHubConnectionRecord {
  userId: string;
  githubUserId: string;
  login: string;
  avatarUrl?: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted?: string;
  accessTokenExpiresAt?: Date;
  refreshTokenExpiresAt?: Date;
  createdAt: string;
  updatedAt: string;
}

export type SaveGitHubConnection = Omit<
  GitHubConnectionRecord,
  "createdAt" | "updatedAt"
>;

export interface ProjectGitHubRepositoryRecord
  extends GitHubRepositorySummary {
  userId: string;
}

export type SaveProjectGitHubRepository = Omit<
  ProjectGitHubRepositoryRecord,
  "createdAt" | "updatedAt"
>;

export interface AuthRepository {
  createUser(input: CreateUserRecord): Promise<UserRecord>;
  findUserByEmail(email: string): Promise<UserRecord | undefined>;
  findUserById(id: string): Promise<UserRecord | undefined>;
  findGitHubConnectionByGitHubUserId(
    githubUserId: string,
  ): Promise<GitHubConnectionRecord | undefined>;
  findGitHubConnectionByUserId(
    userId: string,
  ): Promise<GitHubConnectionRecord | undefined>;
  saveGitHubConnection(
    input: SaveGitHubConnection,
  ): Promise<GitHubConnectionRecord>;
  findProjectGitHubRepository(
    projectId: string,
  ): Promise<ProjectGitHubRepositoryRecord | undefined>;
  saveProjectGitHubRepository(
    input: SaveProjectGitHubRepository,
  ): Promise<ProjectGitHubRepositoryRecord>;
  upsertGitHubWorkflowRuns(runs: GitHubWorkflowRun[]): Promise<void>;
  listGitHubWorkflowRuns(projectId: string): Promise<GitHubWorkflowRun[]>;
  saveRefreshToken(
    tokenHash: string,
    userId: string,
    expiresAt: Date,
  ): Promise<void>;
  isRefreshTokenActive(tokenHash: string, userId: string): Promise<boolean>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  role: UserRole;
  created_at: Date | string;
  updated_at: Date | string;
}

interface GitHubConnectionRow {
  user_id: string;
  github_user_id: string;
  login: string;
  avatar_url: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  access_token_expires_at: Date | string | null;
  refresh_token_expires_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ProjectGitHubRepositoryRow {
  project_id: string;
  user_id: string;
  github_repository_id: string;
  owner_login: string;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  published_files: number;
  last_published_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface GitHubWorkflowRunRow {
  github_run_id: string;
  project_id: string;
  name: string;
  status: PipelineExecutionStatus;
  conclusion: string | null;
  branch: string | null;
  head_sha: string;
  run_number: number;
  event: string;
  html_url: string;
  started_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const optionalDate = (value: Date | string | null): Date | undefined =>
  value ? new Date(value) : undefined;

const mapUser = (row: UserRow): UserRecord => ({
  id: row.id,
  name: row.name,
  email: row.email,
  passwordHash: row.password_hash ?? undefined,
  role: row.role,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

const mapGitHubConnection = (
  row: GitHubConnectionRow,
): GitHubConnectionRecord => ({
  userId: row.user_id,
  githubUserId: row.github_user_id,
  login: row.login,
  avatarUrl: row.avatar_url ?? undefined,
  accessTokenEncrypted: row.access_token_encrypted,
  refreshTokenEncrypted: row.refresh_token_encrypted ?? undefined,
  accessTokenExpiresAt: optionalDate(row.access_token_expires_at),
  refreshTokenExpiresAt: optionalDate(row.refresh_token_expires_at),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

const mapProjectGitHubRepository = (
  row: ProjectGitHubRepositoryRow,
): ProjectGitHubRepositoryRecord => ({
  projectId: row.project_id,
  userId: row.user_id,
  githubRepositoryId: String(row.github_repository_id),
  ownerLogin: row.owner_login,
  name: row.name,
  fullName: row.full_name,
  private: row.private,
  defaultBranch: row.default_branch,
  htmlUrl: row.html_url,
  publishedFiles: row.published_files,
  lastPublishedAt: row.last_published_at
    ? iso(row.last_published_at)
    : undefined,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

const mapGitHubWorkflowRun = (
  row: GitHubWorkflowRunRow,
): GitHubWorkflowRun => ({
  githubRunId: String(row.github_run_id),
  projectId: row.project_id,
  name: row.name,
  status: row.status,
  conclusion: row.conclusion ?? undefined,
  branch: row.branch ?? undefined,
  headSha: row.head_sha,
  runNumber: row.run_number,
  event: row.event,
  htmlUrl: row.html_url,
  startedAt: row.started_at ? iso(row.started_at) : undefined,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly database: DatabasePool) {}

  async createUser(input: CreateUserRecord): Promise<UserRecord> {
    const result = await this.database.query<UserRow>(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        randomUUID(),
        input.name,
        input.email,
        input.passwordHash ?? null,
        input.role,
      ],
    );
    return mapUser(result.rows[0]);
  }

  async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    const result = await this.database.query<UserRow>(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : undefined;
  }

  async findUserById(id: string): Promise<UserRecord | undefined> {
    const result = await this.database.query<UserRow>(
      "SELECT * FROM users WHERE id = $1",
      [id],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : undefined;
  }

  async findGitHubConnectionByGitHubUserId(
    githubUserId: string,
  ): Promise<GitHubConnectionRecord | undefined> {
    const result = await this.database.query<GitHubConnectionRow>(
      "SELECT * FROM github_connections WHERE github_user_id = $1",
      [githubUserId],
    );
    return result.rows[0] ? mapGitHubConnection(result.rows[0]) : undefined;
  }

  async findGitHubConnectionByUserId(
    userId: string,
  ): Promise<GitHubConnectionRecord | undefined> {
    const result = await this.database.query<GitHubConnectionRow>(
      "SELECT * FROM github_connections WHERE user_id = $1",
      [userId],
    );
    return result.rows[0] ? mapGitHubConnection(result.rows[0]) : undefined;
  }

  async saveGitHubConnection(
    input: SaveGitHubConnection,
  ): Promise<GitHubConnectionRecord> {
    const result = await this.database.query<GitHubConnectionRow>(
      `INSERT INTO github_connections
       (user_id, github_user_id, login, avatar_url, access_token_encrypted,
        refresh_token_encrypted, access_token_expires_at, refresh_token_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (github_user_id) DO UPDATE SET
         login = EXCLUDED.login,
         avatar_url = EXCLUDED.avatar_url,
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
         access_token_expires_at = EXCLUDED.access_token_expires_at,
         refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
         updated_at = now()
       RETURNING *`,
      [
        input.userId,
        input.githubUserId,
        input.login,
        input.avatarUrl ?? null,
        input.accessTokenEncrypted,
        input.refreshTokenEncrypted ?? null,
        input.accessTokenExpiresAt ?? null,
        input.refreshTokenExpiresAt ?? null,
      ],
    );
    return mapGitHubConnection(result.rows[0]);
  }

  async findProjectGitHubRepository(
    projectId: string,
  ): Promise<ProjectGitHubRepositoryRecord | undefined> {
    const result = await this.database.query<ProjectGitHubRepositoryRow>(
      "SELECT * FROM project_github_repositories WHERE project_id = $1",
      [projectId],
    );
    return result.rows[0]
      ? mapProjectGitHubRepository(result.rows[0])
      : undefined;
  }

  async saveProjectGitHubRepository(
    input: SaveProjectGitHubRepository,
  ): Promise<ProjectGitHubRepositoryRecord> {
    const result = await this.database.query<ProjectGitHubRepositoryRow>(
      `INSERT INTO project_github_repositories
       (project_id, user_id, github_repository_id, owner_login, name, full_name,
        private, default_branch, html_url, published_files, last_published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (project_id) DO UPDATE SET
         github_repository_id = EXCLUDED.github_repository_id,
         owner_login = EXCLUDED.owner_login,
         name = EXCLUDED.name,
         full_name = EXCLUDED.full_name,
         private = EXCLUDED.private,
         default_branch = EXCLUDED.default_branch,
         html_url = EXCLUDED.html_url,
         published_files = EXCLUDED.published_files,
         last_published_at = EXCLUDED.last_published_at,
         updated_at = now()
       RETURNING *`,
      [
        input.projectId,
        input.userId,
        input.githubRepositoryId,
        input.ownerLogin,
        input.name,
        input.fullName,
        input.private,
        input.defaultBranch,
        input.htmlUrl,
        input.publishedFiles,
        input.lastPublishedAt ?? null,
      ],
    );
    return mapProjectGitHubRepository(result.rows[0]);
  }

  async upsertGitHubWorkflowRuns(runs: GitHubWorkflowRun[]): Promise<void> {
    for (const run of runs) {
      await this.database.query(
        `INSERT INTO github_workflow_runs
         (github_run_id, project_id, name, status, conclusion, branch, head_sha,
          run_number, event, html_url, started_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (github_run_id) DO UPDATE SET
           name = EXCLUDED.name,
           status = EXCLUDED.status,
           conclusion = EXCLUDED.conclusion,
           branch = EXCLUDED.branch,
           head_sha = EXCLUDED.head_sha,
           run_number = EXCLUDED.run_number,
           event = EXCLUDED.event,
           html_url = EXCLUDED.html_url,
           started_at = EXCLUDED.started_at,
           created_at = EXCLUDED.created_at,
           updated_at = EXCLUDED.updated_at`,
        [
          run.githubRunId,
          run.projectId,
          run.name,
          run.status,
          run.conclusion ?? null,
          run.branch ?? null,
          run.headSha,
          run.runNumber,
          run.event,
          run.htmlUrl,
          run.startedAt ?? null,
          run.createdAt,
          run.updatedAt,
        ],
      );
    }
  }

  async listGitHubWorkflowRuns(projectId: string): Promise<GitHubWorkflowRun[]> {
    const result = await this.database.query<GitHubWorkflowRunRow>(
      `SELECT * FROM github_workflow_runs
       WHERE project_id = $1
       ORDER BY created_at DESC, run_number DESC`,
      [projectId],
    );
    return result.rows.map(mapGitHubWorkflowRun);
  }

  async saveRefreshToken(
    tokenHash: string,
    userId: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.database.query(
      "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
      [randomUUID(), userId, tokenHash, expiresAt],
    );
  }

  async isRefreshTokenActive(
    tokenHash: string,
    userId: string,
  ): Promise<boolean> {
    const result = await this.database.query(
      `SELECT 1 FROM refresh_tokens
       WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()`,
      [tokenHash, userId],
    );
    return Boolean(result.rowCount);
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.database.query(
      "UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1",
      [tokenHash],
    );
  }
}

export class InMemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, UserRecord>();
  private readonly refreshTokens = new Map<
    string,
    { userId: string; expiresAt: Date; revoked: boolean }
  >();
  private readonly githubConnections = new Map<
    string,
    GitHubConnectionRecord
  >();
  private readonly projectGitHubRepositories = new Map<
    string,
    ProjectGitHubRepositoryRecord
  >();
  private readonly githubWorkflowRuns = new Map<string, GitHubWorkflowRun>();

  async createUser(input: CreateUserRecord): Promise<UserRecord> {
    const timestamp = new Date().toISOString();
    const user: UserRecord = {
      id: randomUUID(),
      ...input,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.users.set(user.id, user);
    return user;
  }

  async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    return [...this.users.values()].find((user) => user.email === email);
  }

  async findUserById(id: string): Promise<UserRecord | undefined> {
    return this.users.get(id);
  }

  async findGitHubConnectionByGitHubUserId(
    githubUserId: string,
  ): Promise<GitHubConnectionRecord | undefined> {
    return this.githubConnections.get(githubUserId);
  }

  async findGitHubConnectionByUserId(
    userId: string,
  ): Promise<GitHubConnectionRecord | undefined> {
    return [...this.githubConnections.values()].find(
      (connection) => connection.userId === userId,
    );
  }

  async saveGitHubConnection(
    input: SaveGitHubConnection,
  ): Promise<GitHubConnectionRecord> {
    const existing = this.githubConnections.get(input.githubUserId);
    const timestamp = new Date().toISOString();
    const connection: GitHubConnectionRecord = {
      ...input,
      userId: existing?.userId ?? input.userId,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.githubConnections.set(input.githubUserId, connection);
    return connection;
  }

  async findProjectGitHubRepository(
    projectId: string,
  ): Promise<ProjectGitHubRepositoryRecord | undefined> {
    return this.projectGitHubRepositories.get(projectId);
  }

  async saveProjectGitHubRepository(
    input: SaveProjectGitHubRepository,
  ): Promise<ProjectGitHubRepositoryRecord> {
    const existing = this.projectGitHubRepositories.get(input.projectId);
    const timestamp = new Date().toISOString();
    const repository: ProjectGitHubRepositoryRecord = {
      ...input,
      userId: existing?.userId ?? input.userId,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.projectGitHubRepositories.set(input.projectId, repository);
    return repository;
  }

  async upsertGitHubWorkflowRuns(runs: GitHubWorkflowRun[]): Promise<void> {
    for (const run of runs) this.githubWorkflowRuns.set(run.githubRunId, run);
  }

  async listGitHubWorkflowRuns(projectId: string): Promise<GitHubWorkflowRun[]> {
    return [...this.githubWorkflowRuns.values()]
      .filter((run) => run.projectId === projectId)
      .sort(
        (left, right) =>
          Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
          right.runNumber - left.runNumber,
      );
  }

  async saveRefreshToken(
    tokenHash: string,
    userId: string,
    expiresAt: Date,
  ): Promise<void> {
    this.refreshTokens.set(tokenHash, { userId, expiresAt, revoked: false });
  }

  async isRefreshTokenActive(
    tokenHash: string,
    userId: string,
  ): Promise<boolean> {
    const token = this.refreshTokens.get(tokenHash);
    return Boolean(
      token &&
      token.userId === userId &&
      !token.revoked &&
      token.expiresAt > new Date(),
    );
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    const token = this.refreshTokens.get(tokenHash);
    if (token) token.revoked = true;
  }
}
