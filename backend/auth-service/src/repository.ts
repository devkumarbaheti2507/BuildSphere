import { randomUUID } from "node:crypto";
import type { UserRole, UserSummary } from "@buildsphere/shared-types";
import type { DatabasePool } from "@buildsphere/service-core/database";

export interface UserRecord extends UserSummary {
  passwordHash: string;
}

export interface CreateUserRecord {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

export interface AuthRepository {
  createUser(input: CreateUserRecord): Promise<UserRecord>;
  findUserByEmail(email: string): Promise<UserRecord | undefined>;
  findUserById(id: string): Promise<UserRecord | undefined>;
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
  password_hash: string;
  role: UserRole;
  created_at: Date | string;
  updated_at: Date | string;
}

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const mapUser = (row: UserRow): UserRecord => ({
  id: row.id,
  name: row.name,
  email: row.email,
  passwordHash: row.password_hash,
  role: row.role,
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
      [randomUUID(), input.name, input.email, input.passwordHash, input.role],
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
