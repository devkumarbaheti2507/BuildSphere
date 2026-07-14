import { existsSync, promises as fs } from "node:fs";
import process from "node:process";
import path from "node:path";
import { Pool, type PoolConfig } from "pg";
import { resolveBuildSphereRoot } from "./config.js";

const repoRoot = resolveBuildSphereRoot(import.meta.url);
const environmentFile = path.join(repoRoot, ".env");
if (existsSync(environmentFile)) {
  process.loadEnvFile(environmentFile);
}

const poolConfig = (): PoolConfig => {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  if (
    !process.env.POSTGRES_DB ||
    !process.env.POSTGRES_USER ||
    !process.env.POSTGRES_PASSWORD
  ) {
    throw new Error(
      "Set DATABASE_URL or the POSTGRES_DB, POSTGRES_USER, and POSTGRES_PASSWORD variables",
    );
  }

  return {
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  };
};

const migrationsDirectory = path.join(
  repoRoot,
  "infrastructure",
  "database",
  "migrations",
);
const pool = new Pool(poolConfig());

try {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [7_240_611]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const files = (await fs.readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const alreadyApplied = await client.query(
        "SELECT 1 FROM schema_migrations WHERE name = $1",
        [file],
      );
      if (alreadyApplied.rowCount) {
        console.log(`Migration already applied: ${file}`);
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(
          await fs.readFile(path.join(migrationsDirectory, file), "utf8"),
        );
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
          file,
        ]);
        await client.query("COMMIT");
        console.log(`Applied migration: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [7_240_611]);
    client.release();
  }
} finally {
  await pool.end();
}
