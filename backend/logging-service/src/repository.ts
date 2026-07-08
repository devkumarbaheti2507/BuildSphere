import { randomUUID } from "node:crypto";
import type { LogLevel, PipelineLog } from "@buildsphere/shared-types";
import type { DatabasePool } from "@buildsphere/service-core/database";

export interface AppendLogInput {
  ownerId: string;
  executionId: string;
  stageKey: string;
  level: LogLevel;
  message: string;
}

export interface LogRepository {
  append(input: AppendLogInput): Promise<PipelineLog>;
  list(ownerId: string, executionId: string): Promise<PipelineLog[]>;
}

interface LogRow {
  id: string;
  execution_id: string;
  stage_key: string;
  level: LogLevel;
  message: string;
  timestamp: Date | string;
}

const mapLog = (row: LogRow): PipelineLog => ({
  id: row.id,
  executionId: row.execution_id,
  stageKey: row.stage_key,
  level: row.level,
  message: row.message,
  timestamp:
    row.timestamp instanceof Date
      ? row.timestamp.toISOString()
      : new Date(row.timestamp).toISOString(),
});

export class PostgresLogRepository implements LogRepository {
  constructor(private readonly database: DatabasePool) {}

  async append(input: AppendLogInput): Promise<PipelineLog> {
    const result = await this.database.query<LogRow>(
      `INSERT INTO pipeline_logs (id, owner_id, execution_id, stage_key, level, message)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        randomUUID(),
        input.ownerId,
        input.executionId,
        input.stageKey,
        input.level,
        input.message,
      ],
    );
    return mapLog(result.rows[0]);
  }

  async list(ownerId: string, executionId: string): Promise<PipelineLog[]> {
    const result = await this.database.query<LogRow>(
      `SELECT id, execution_id, stage_key, level, message, timestamp
       FROM pipeline_logs WHERE owner_id = $1 AND execution_id = $2 ORDER BY timestamp, id`,
      [ownerId, executionId],
    );
    return result.rows.map(mapLog);
  }
}

export class InMemoryLogRepository implements LogRepository {
  private readonly logs: Array<PipelineLog & { ownerId: string }> = [];

  async append(input: AppendLogInput): Promise<PipelineLog> {
    const log = {
      id: randomUUID(),
      ...input,
      timestamp: new Date().toISOString(),
    };
    this.logs.push(log);
    const { ownerId: _ownerId, ...publicLog } = log;
    return publicLog;
  }

  async list(ownerId: string, executionId: string): Promise<PipelineLog[]> {
    return this.logs
      .filter(
        (log) => log.ownerId === ownerId && log.executionId === executionId,
      )
      .map(({ ownerId: _ownerId, ...log }) => structuredClone(log));
  }
}
