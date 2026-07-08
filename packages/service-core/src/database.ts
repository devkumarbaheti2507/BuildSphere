import { Pool, type PoolClient, type PoolConfig } from "pg";

export interface QueryResult<Row> {
  rows: Row[];
  rowCount: number | null;
}

export interface Queryable {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
}

export interface DatabaseClient extends Queryable {
  release(): void;
}

export interface DatabasePool extends Queryable {
  connect(): Promise<DatabaseClient>;
  end(): Promise<void>;
}

const databaseConfig = (): PoolConfig => {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  const database = process.env.POSTGRES_DB;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  if (!database || !user || !password) {
    throw new Error(
      "Set DATABASE_URL or POSTGRES_DB, POSTGRES_USER, and POSTGRES_PASSWORD",
    );
  }

  return {
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database,
    user,
    password,
  };
};

export const createDatabasePool = (): DatabasePool =>
  new Pool(databaseConfig());

export const withTransaction = async <T>(
  pool: DatabasePool,
  operation: (client: DatabaseClient) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
