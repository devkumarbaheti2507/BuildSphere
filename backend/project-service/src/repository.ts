import { randomUUID } from "node:crypto";
import type {
  GeneratedArtifact,
  GeneratedFile,
  ProjectSummary,
  ProjectStatus,
  ProjectVisibility,
  ToolSelection,
} from "@buildsphere/shared-types";
import type { DatabasePool } from "@buildsphere/service-core/database";

export interface CreateProjectRecord {
  ownerId: string;
  name: string;
  description?: string;
  architectureType: ProjectSummary["architectureType"];
  visibility: ProjectVisibility;
}

export interface UpdateProjectRecord {
  name?: string;
  description?: string;
  visibility?: ProjectVisibility;
  status?: ProjectStatus;
}

export interface ProjectRepository {
  create(input: CreateProjectRecord): Promise<ProjectSummary>;
  listByOwner(ownerId: string): Promise<ProjectSummary[]>;
  findById(id: string): Promise<ProjectSummary | undefined>;
  findByOwnerAndName(
    ownerId: string,
    name: string,
  ): Promise<ProjectSummary | undefined>;
  update(id: string, input: UpdateProjectRecord): Promise<ProjectSummary>;
  replaceToolSelections(
    projectId: string,
    selections: ToolSelection[],
  ): Promise<void>;
  createArtifact(
    projectId: string,
    files: GeneratedFile[],
    checksum: string,
  ): Promise<GeneratedArtifact>;
  listArtifacts(projectId: string): Promise<GeneratedArtifact[]>;
  findArtifact(id: string): Promise<GeneratedArtifact | undefined>;
}

interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  architecture_type: ProjectSummary["architectureType"];
  visibility: ProjectVisibility;
  status: ProjectStatus;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ToolRow {
  category: ToolSelection["category"];
  tool_key: ToolSelection["toolKey"];
  config: Record<string, unknown>;
}

interface ArtifactRow {
  id: string;
  project_id: string;
  artifact_type: "bundle";
  files: GeneratedFile[];
  checksum: string;
  created_at: Date | string;
}

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const mapArtifact = (row: ArtifactRow): GeneratedArtifact => ({
  id: row.id,
  projectId: row.project_id,
  artifactType: row.artifact_type,
  files: row.files,
  checksum: row.checksum,
  createdAt: iso(row.created_at),
});

export class PostgresProjectRepository implements ProjectRepository {
  constructor(private readonly database: DatabasePool) {}

  async create(input: CreateProjectRecord): Promise<ProjectSummary> {
    const result = await this.database.query<ProjectRow>(
      `INSERT INTO projects (id, owner_id, name, description, architecture_type, visibility)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        randomUUID(),
        input.ownerId,
        input.name,
        input.description ?? null,
        input.architectureType,
        input.visibility,
      ],
    );
    return this.hydrate(result.rows[0]);
  }

  async listByOwner(ownerId: string): Promise<ProjectSummary[]> {
    const result = await this.database.query<ProjectRow>(
      "SELECT * FROM projects WHERE owner_id = $1 ORDER BY updated_at DESC",
      [ownerId],
    );
    return Promise.all(result.rows.map((row) => this.hydrate(row)));
  }

  async findById(id: string): Promise<ProjectSummary | undefined> {
    const result = await this.database.query<ProjectRow>(
      "SELECT * FROM projects WHERE id = $1",
      [id],
    );
    return result.rows[0] ? this.hydrate(result.rows[0]) : undefined;
  }

  async findByOwnerAndName(
    ownerId: string,
    name: string,
  ): Promise<ProjectSummary | undefined> {
    const result = await this.database.query<ProjectRow>(
      "SELECT * FROM projects WHERE owner_id = $1 AND lower(name) = lower($2)",
      [ownerId, name],
    );
    return result.rows[0] ? this.hydrate(result.rows[0]) : undefined;
  }

  async update(
    id: string,
    input: UpdateProjectRecord,
  ): Promise<ProjectSummary> {
    const current = await this.findById(id);
    if (!current) throw new Error("Project disappeared during update");
    const result = await this.database.query<ProjectRow>(
      `UPDATE projects
       SET name = $2, description = $3, visibility = $4, status = $5, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [
        id,
        input.name ?? current.name,
        input.description ?? current.description ?? null,
        input.visibility ?? current.visibility,
        input.status ?? current.status,
      ],
    );
    return this.hydrate(result.rows[0]);
  }

  async replaceToolSelections(
    projectId: string,
    selections: ToolSelection[],
  ): Promise<void> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM project_tool_selections WHERE project_id = $1",
        [projectId],
      );
      for (const selection of selections) {
        await client.query(
          `INSERT INTO project_tool_selections (id, project_id, category, tool_key, config)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            randomUUID(),
            projectId,
            selection.category,
            selection.toolKey,
            JSON.stringify(selection.config),
          ],
        );
      }
      await client.query(
        "UPDATE projects SET updated_at = now() WHERE id = $1",
        [projectId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createArtifact(
    projectId: string,
    files: GeneratedFile[],
    checksum: string,
  ): Promise<GeneratedArtifact> {
    const result = await this.database.query<ArtifactRow>(
      `INSERT INTO generated_artifacts (id, project_id, artifact_type, files, checksum)
       VALUES ($1, $2, 'bundle', $3, $4) RETURNING *`,
      [randomUUID(), projectId, JSON.stringify(files), checksum],
    );
    return mapArtifact(result.rows[0]);
  }

  async listArtifacts(projectId: string): Promise<GeneratedArtifact[]> {
    const result = await this.database.query<ArtifactRow>(
      "SELECT * FROM generated_artifacts WHERE project_id = $1 ORDER BY created_at DESC",
      [projectId],
    );
    return result.rows.map(mapArtifact);
  }

  async findArtifact(id: string): Promise<GeneratedArtifact | undefined> {
    const result = await this.database.query<ArtifactRow>(
      "SELECT * FROM generated_artifacts WHERE id = $1",
      [id],
    );
    return result.rows[0] ? mapArtifact(result.rows[0]) : undefined;
  }

  private async hydrate(row: ProjectRow): Promise<ProjectSummary> {
    const tools = await this.database.query<ToolRow>(
      "SELECT category, tool_key, config FROM project_tool_selections WHERE project_id = $1 ORDER BY category",
      [row.id],
    );
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      description: row.description ?? undefined,
      architectureType: row.architecture_type,
      visibility: row.visibility,
      status: row.status,
      toolSelections: tools.rows.map((tool) => ({
        category: tool.category,
        toolKey: tool.tool_key,
        config: tool.config,
      })),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    };
  }
}

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly projects = new Map<string, ProjectSummary>();
  private readonly artifacts = new Map<string, GeneratedArtifact>();

  async create(input: CreateProjectRecord): Promise<ProjectSummary> {
    const timestamp = new Date().toISOString();
    const project: ProjectSummary = {
      id: randomUUID(),
      ...input,
      toolSelections: [],
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.projects.set(project.id, project);
    return structuredClone(project);
  }

  async listByOwner(ownerId: string): Promise<ProjectSummary[]> {
    return [...this.projects.values()]
      .filter((project) => project.ownerId === ownerId)
      .map((project) => structuredClone(project));
  }

  async findById(id: string): Promise<ProjectSummary | undefined> {
    const project = this.projects.get(id);
    return project ? structuredClone(project) : undefined;
  }

  async findByOwnerAndName(
    ownerId: string,
    name: string,
  ): Promise<ProjectSummary | undefined> {
    const project = [...this.projects.values()].find(
      (candidate) =>
        candidate.ownerId === ownerId &&
        candidate.name.toLowerCase() === name.toLowerCase(),
    );
    return project ? structuredClone(project) : undefined;
  }

  async update(
    id: string,
    input: UpdateProjectRecord,
  ): Promise<ProjectSummary> {
    const project = this.projects.get(id);
    if (!project) throw new Error("Project not found");
    const updated = {
      ...project,
      ...input,
      updatedAt: new Date().toISOString(),
    };
    this.projects.set(id, updated);
    return structuredClone(updated);
  }

  async replaceToolSelections(
    projectId: string,
    selections: ToolSelection[],
  ): Promise<void> {
    const project = this.projects.get(projectId);
    if (project) {
      project.toolSelections = structuredClone(selections);
      project.updatedAt = new Date().toISOString();
    }
  }

  async createArtifact(
    projectId: string,
    files: GeneratedFile[],
    checksum: string,
  ): Promise<GeneratedArtifact> {
    const artifact: GeneratedArtifact = {
      id: randomUUID(),
      projectId,
      artifactType: "bundle",
      files: structuredClone(files),
      checksum,
      createdAt: new Date().toISOString(),
    };
    this.artifacts.set(artifact.id, artifact);
    return structuredClone(artifact);
  }

  async listArtifacts(projectId: string): Promise<GeneratedArtifact[]> {
    return [...this.artifacts.values()]
      .filter((artifact) => artifact.projectId === projectId)
      .map((artifact) => structuredClone(artifact));
  }

  async findArtifact(id: string): Promise<GeneratedArtifact | undefined> {
    const artifact = this.artifacts.get(id);
    return artifact ? structuredClone(artifact) : undefined;
  }
}
