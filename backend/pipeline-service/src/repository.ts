import { randomUUID } from "node:crypto";
import type {
  PipelineDefinition,
  PipelineExecutionStage,
  PipelineExecutionStatus,
  PipelineExecutionSummary,
  PipelineStage,
} from "@buildsphere/shared-types";
import type { DatabasePool } from "@buildsphere/service-core/database";

export interface PipelineRecord extends PipelineDefinition {
  ownerId: string;
}

export interface PipelineRepository {
  createDefinition(
    ownerId: string,
    projectId: string,
    name: string,
    provider: PipelineDefinition["provider"],
    stages: PipelineStage[],
  ): Promise<PipelineRecord>;
  listDefinitions(
    ownerId: string,
    projectId: string,
  ): Promise<PipelineRecord[]>;
  findDefinition(
    ownerId: string,
    pipelineId: string,
  ): Promise<PipelineRecord | undefined>;
  createExecution(
    pipelineId: string,
    stages: PipelineExecutionStage[],
    triggerType: PipelineExecutionSummary["triggerType"],
  ): Promise<PipelineExecutionSummary>;
  listExecutions(
    ownerId: string,
    pipelineId: string,
  ): Promise<PipelineExecutionSummary[]>;
  findExecution(
    ownerId: string,
    executionId: string,
  ): Promise<PipelineExecutionSummary | undefined>;
  updateExecution(
    executionId: string,
    input: {
      status: PipelineExecutionStatus;
      stages: PipelineExecutionStage[];
      startedAt?: string;
      finishedAt?: string;
    },
  ): Promise<PipelineExecutionSummary>;
}

interface DefinitionRow {
  id: string;
  owner_id: string;
  project_id: string;
  name: string;
  provider: PipelineDefinition["provider"];
  stages: PipelineStage[];
  created_at: Date | string;
}
interface ExecutionRow {
  id: string;
  pipeline_id: string;
  status: PipelineExecutionStatus;
  stages: PipelineExecutionStage[];
  trigger_type: PipelineExecutionSummary["triggerType"];
  started_at: Date | string | null;
  finished_at: Date | string | null;
  created_at: Date | string;
}
const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const mapDefinition = (row: DefinitionRow): PipelineRecord => ({
  id: row.id,
  ownerId: row.owner_id,
  projectId: row.project_id,
  name: row.name,
  provider: row.provider,
  stages: row.stages,
  createdAt: iso(row.created_at),
});
const mapExecution = (row: ExecutionRow): PipelineExecutionSummary => ({
  id: row.id,
  pipelineId: row.pipeline_id,
  status: row.status,
  stages: row.stages,
  triggerType: row.trigger_type,
  startedAt: row.started_at ? iso(row.started_at) : undefined,
  finishedAt: row.finished_at ? iso(row.finished_at) : undefined,
  createdAt: iso(row.created_at),
});

export class PostgresPipelineRepository implements PipelineRepository {
  constructor(private readonly database: DatabasePool) {}

  async createDefinition(
    ownerId: string,
    projectId: string,
    name: string,
    provider: PipelineDefinition["provider"],
    stages: PipelineStage[],
  ): Promise<PipelineRecord> {
    const result = await this.database.query<DefinitionRow>(
      `INSERT INTO pipeline_definitions (id, owner_id, project_id, name, provider, stages)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        randomUUID(),
        ownerId,
        projectId,
        name,
        provider,
        JSON.stringify(stages),
      ],
    );
    return mapDefinition(result.rows[0]);
  }

  async listDefinitions(
    ownerId: string,
    projectId: string,
  ): Promise<PipelineRecord[]> {
    const result = await this.database.query<DefinitionRow>(
      "SELECT * FROM pipeline_definitions WHERE owner_id = $1 AND project_id = $2 ORDER BY created_at DESC",
      [ownerId, projectId],
    );
    return result.rows.map(mapDefinition);
  }

  async findDefinition(
    ownerId: string,
    pipelineId: string,
  ): Promise<PipelineRecord | undefined> {
    const result = await this.database.query<DefinitionRow>(
      "SELECT * FROM pipeline_definitions WHERE owner_id = $1 AND id = $2",
      [ownerId, pipelineId],
    );
    return result.rows[0] ? mapDefinition(result.rows[0]) : undefined;
  }

  async createExecution(
    pipelineId: string,
    stages: PipelineExecutionStage[],
    triggerType: PipelineExecutionSummary["triggerType"],
  ): Promise<PipelineExecutionSummary> {
    const result = await this.database.query<ExecutionRow>(
      `INSERT INTO pipeline_executions (id, pipeline_id, status, stages, trigger_type)
       VALUES ($1, $2, 'queued', $3, $4) RETURNING *`,
      [randomUUID(), pipelineId, JSON.stringify(stages), triggerType],
    );
    return mapExecution(result.rows[0]);
  }

  async listExecutions(
    ownerId: string,
    pipelineId: string,
  ): Promise<PipelineExecutionSummary[]> {
    const result = await this.database.query<ExecutionRow>(
      `SELECT e.* FROM pipeline_executions e JOIN pipeline_definitions d ON d.id = e.pipeline_id
       WHERE d.owner_id = $1 AND e.pipeline_id = $2 ORDER BY e.created_at DESC`,
      [ownerId, pipelineId],
    );
    return result.rows.map(mapExecution);
  }

  async findExecution(
    ownerId: string,
    executionId: string,
  ): Promise<PipelineExecutionSummary | undefined> {
    const result = await this.database.query<ExecutionRow>(
      `SELECT e.* FROM pipeline_executions e JOIN pipeline_definitions d ON d.id = e.pipeline_id
       WHERE d.owner_id = $1 AND e.id = $2`,
      [ownerId, executionId],
    );
    return result.rows[0] ? mapExecution(result.rows[0]) : undefined;
  }

  async updateExecution(
    executionId: string,
    input: {
      status: PipelineExecutionStatus;
      stages: PipelineExecutionStage[];
      startedAt?: string;
      finishedAt?: string;
    },
  ): Promise<PipelineExecutionSummary> {
    const result = await this.database.query<ExecutionRow>(
      `UPDATE pipeline_executions SET status = $2, stages = $3, started_at = $4, finished_at = $5
       WHERE id = $1 RETURNING *`,
      [
        executionId,
        input.status,
        JSON.stringify(input.stages),
        input.startedAt ?? null,
        input.finishedAt ?? null,
      ],
    );
    return mapExecution(result.rows[0]);
  }
}

export class InMemoryPipelineRepository implements PipelineRepository {
  private readonly definitions = new Map<string, PipelineRecord>();
  private readonly executions = new Map<string, PipelineExecutionSummary>();

  async createDefinition(
    ownerId: string,
    projectId: string,
    name: string,
    provider: PipelineDefinition["provider"],
    stages: PipelineStage[],
  ): Promise<PipelineRecord> {
    const definition = {
      id: randomUUID(),
      ownerId,
      projectId,
      name,
      provider,
      stages: structuredClone(stages),
      createdAt: new Date().toISOString(),
    };
    this.definitions.set(definition.id, definition);
    return structuredClone(definition);
  }
  async listDefinitions(
    ownerId: string,
    projectId: string,
  ): Promise<PipelineRecord[]> {
    return [...this.definitions.values()]
      .filter(
        (item) => item.ownerId === ownerId && item.projectId === projectId,
      )
      .map((item) => structuredClone(item));
  }
  async findDefinition(
    ownerId: string,
    pipelineId: string,
  ): Promise<PipelineRecord | undefined> {
    const item = this.definitions.get(pipelineId);
    return item?.ownerId === ownerId ? structuredClone(item) : undefined;
  }
  async createExecution(
    pipelineId: string,
    stages: PipelineExecutionStage[],
    triggerType: PipelineExecutionSummary["triggerType"],
  ): Promise<PipelineExecutionSummary> {
    const execution = {
      id: randomUUID(),
      pipelineId,
      status: "queued" as const,
      stages: structuredClone(stages),
      triggerType,
      createdAt: new Date().toISOString(),
    };
    this.executions.set(execution.id, execution);
    return structuredClone(execution);
  }
  async listExecutions(
    ownerId: string,
    pipelineId: string,
  ): Promise<PipelineExecutionSummary[]> {
    if ((await this.findDefinition(ownerId, pipelineId)) === undefined)
      return [];
    return [...this.executions.values()]
      .filter((item) => item.pipelineId === pipelineId)
      .map((item) => structuredClone(item));
  }
  async findExecution(
    ownerId: string,
    executionId: string,
  ): Promise<PipelineExecutionSummary | undefined> {
    const item = this.executions.get(executionId);
    if (!item || !(await this.findDefinition(ownerId, item.pipelineId)))
      return undefined;
    return structuredClone(item);
  }
  async updateExecution(
    executionId: string,
    input: {
      status: PipelineExecutionStatus;
      stages: PipelineExecutionStage[];
      startedAt?: string;
      finishedAt?: string;
    },
  ): Promise<PipelineExecutionSummary> {
    const current = this.executions.get(executionId);
    if (!current) throw new Error("Execution not found");
    const updated = { ...current, ...structuredClone(input) };
    this.executions.set(executionId, updated);
    return structuredClone(updated);
  }
}
