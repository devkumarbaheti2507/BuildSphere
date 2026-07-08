import { randomUUID } from "node:crypto";
import type {
  DeploymentEnvironment,
  DeploymentTarget,
} from "@buildsphere/shared-types";
import type { DatabasePool } from "@buildsphere/service-core/database";

export interface DeploymentRepository {
  create(
    ownerId: string,
    input: {
      projectId: string;
      name: string;
      environment: DeploymentEnvironment;
      config: Record<string, unknown>;
    },
  ): Promise<DeploymentTarget>;
  list(ownerId: string, projectId: string): Promise<DeploymentTarget[]>;
  find(ownerId: string, id: string): Promise<DeploymentTarget | undefined>;
}
interface TargetRow {
  id: string;
  project_id: string;
  name: string;
  type: "kubernetes";
  environment: DeploymentEnvironment;
  config: Record<string, unknown>;
  created_at: Date | string;
  updated_at: Date | string;
}
const mapTarget = (row: TargetRow): DeploymentTarget => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name,
  type: row.type,
  environment: row.environment,
  config: row.config,
  createdAt:
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString(),
  updatedAt:
    row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : new Date(row.updated_at).toISOString(),
});

export class PostgresDeploymentRepository implements DeploymentRepository {
  constructor(private readonly database: DatabasePool) {}
  async create(
    ownerId: string,
    input: {
      projectId: string;
      name: string;
      environment: DeploymentEnvironment;
      config: Record<string, unknown>;
    },
  ): Promise<DeploymentTarget> {
    const result = await this.database.query<TargetRow>(
      `INSERT INTO deployment_targets (id, owner_id, project_id, name, type, environment, config)
       VALUES ($1, $2, $3, $4, 'kubernetes', $5, $6) RETURNING *`,
      [
        randomUUID(),
        ownerId,
        input.projectId,
        input.name,
        input.environment,
        JSON.stringify(input.config),
      ],
    );
    return mapTarget(result.rows[0]);
  }
  async list(ownerId: string, projectId: string): Promise<DeploymentTarget[]> {
    const result = await this.database.query<TargetRow>(
      "SELECT * FROM deployment_targets WHERE owner_id = $1 AND project_id = $2 ORDER BY created_at DESC",
      [ownerId, projectId],
    );
    return result.rows.map(mapTarget);
  }
  async find(
    ownerId: string,
    id: string,
  ): Promise<DeploymentTarget | undefined> {
    const result = await this.database.query<TargetRow>(
      "SELECT * FROM deployment_targets WHERE owner_id = $1 AND id = $2",
      [ownerId, id],
    );
    return result.rows[0] ? mapTarget(result.rows[0]) : undefined;
  }
}

export class InMemoryDeploymentRepository implements DeploymentRepository {
  private readonly targets = new Map<
    string,
    DeploymentTarget & { ownerId: string }
  >();
  async create(
    ownerId: string,
    input: {
      projectId: string;
      name: string;
      environment: DeploymentEnvironment;
      config: Record<string, unknown>;
    },
  ): Promise<DeploymentTarget> {
    const now = new Date().toISOString();
    const target = {
      id: randomUUID(),
      ownerId,
      ...input,
      type: "kubernetes" as const,
      createdAt: now,
      updatedAt: now,
    };
    this.targets.set(target.id, target);
    const { ownerId: _ownerId, ...publicTarget } = target;
    return publicTarget;
  }
  async list(ownerId: string, projectId: string): Promise<DeploymentTarget[]> {
    return [...this.targets.values()]
      .filter(
        (target) =>
          target.ownerId === ownerId && target.projectId === projectId,
      )
      .map(({ ownerId: _ownerId, ...target }) => structuredClone(target));
  }
  async find(
    ownerId: string,
    id: string,
  ): Promise<DeploymentTarget | undefined> {
    const target = this.targets.get(id);
    if (!target || target.ownerId !== ownerId) return undefined;
    const { ownerId: _ownerId, ...publicTarget } = target;
    return structuredClone(publicTarget);
  }
}
