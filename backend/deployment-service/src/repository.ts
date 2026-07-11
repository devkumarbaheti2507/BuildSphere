import { randomUUID } from "node:crypto";
import type {
  DeploymentEnvironment,
  DeploymentTarget,
  KubernetesConnectionSummary,
  KubernetesCredentialMechanism,
  KubernetesTargetConfig,
} from "@buildsphere/shared-types";
import { withTransaction } from "@buildsphere/service-core/database";
import type { DatabasePool } from "@buildsphere/service-core/database";

export interface StoredKubernetesCredential {
  targetId: string;
  encryptedKubeconfig: string;
  keyVersion: "v1";
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentRepository {
  create(
    ownerId: string,
    input: {
      projectId: string;
      name: string;
      environment: DeploymentEnvironment;
      config: KubernetesTargetConfig;
    },
  ): Promise<DeploymentTarget>;
  list(ownerId: string, projectId: string): Promise<DeploymentTarget[]>;
  find(ownerId: string, id: string): Promise<DeploymentTarget | undefined>;
  saveCredential(
    ownerId: string,
    targetId: string,
    input: {
      encryptedKubeconfig: string;
      keyVersion: "v1";
      fingerprint: string;
      connection: KubernetesConnectionSummary;
      storedAt: string;
    },
  ): Promise<DeploymentTarget | undefined>;
  findCredential(
    ownerId: string,
    targetId: string,
  ): Promise<StoredKubernetesCredential | undefined>;
  deleteCredential(
    ownerId: string,
    targetId: string,
  ): Promise<DeploymentTarget | undefined>;
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

interface CredentialRow {
  target_id: string;
  kubeconfig_encrypted: string;
  key_version: "v1";
  fingerprint: string;
  created_at: Date | string;
  updated_at: Date | string;
}

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const credentialMechanisms = new Set<KubernetesCredentialMechanism>([
  "token",
  "client-certificate",
  "exec",
  "auth-provider",
  "basic",
  "none",
]);

const normalizedConnection = (
  value: unknown,
): KubernetesConnectionSummary | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const summary = value as Record<string, unknown>;
  if (
    typeof summary.context !== "string" ||
    typeof summary.cluster !== "string" ||
    typeof summary.serverHost !== "string" ||
    typeof summary.namespace !== "string" ||
    typeof summary.credentialMechanism !== "string" ||
    !credentialMechanisms.has(
      summary.credentialMechanism as KubernetesCredentialMechanism,
    ) ||
    !["enabled", "disabled"].includes(String(summary.tlsVerification)) ||
    !Number.isInteger(summary.contextCount) ||
    Number(summary.contextCount) < 1
  ) {
    return undefined;
  }
  return {
    context: summary.context,
    cluster: summary.cluster,
    serverHost: summary.serverHost,
    namespace: summary.namespace,
    credentialMechanism:
      summary.credentialMechanism as KubernetesCredentialMechanism,
    tlsVerification: summary.tlsVerification as "enabled" | "disabled",
    contextCount: Number(summary.contextCount),
  };
};

const normalizeTargetConfig = (
  value: Record<string, unknown>,
): KubernetesTargetConfig => {
  const connection = normalizedConnection(value.connection);
  if (value.connectionStatus === "connected" && connection) {
    const storedAt = value.credentialStoredAt;
    if (typeof storedAt === "string" && !Number.isNaN(Date.parse(storedAt))) {
      return {
        connectionStatus: "connected",
        connection,
        credentialStoredAt: new Date(storedAt).toISOString(),
      };
    }
  }
  if (value.connectionStatus === "inspected" && connection) {
    return { connectionStatus: "inspected", connection };
  }
  return { connectionStatus: "draft" };
};

const mapTarget = (row: TargetRow): DeploymentTarget => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name,
  type: row.type,
  environment: row.environment,
  config: normalizeTargetConfig(row.config),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

const mapCredential = (row: CredentialRow): StoredKubernetesCredential => ({
  targetId: row.target_id,
  encryptedKubeconfig: row.kubeconfig_encrypted,
  keyVersion: row.key_version,
  fingerprint: row.fingerprint,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

export class PostgresDeploymentRepository implements DeploymentRepository {
  constructor(private readonly database: DatabasePool) {}

  async create(
    ownerId: string,
    input: {
      projectId: string;
      name: string;
      environment: DeploymentEnvironment;
      config: KubernetesTargetConfig;
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

  async saveCredential(
    ownerId: string,
    targetId: string,
    input: {
      encryptedKubeconfig: string;
      keyVersion: "v1";
      fingerprint: string;
      connection: KubernetesConnectionSummary;
      storedAt: string;
    },
  ): Promise<DeploymentTarget | undefined> {
    return withTransaction(this.database, async (client) => {
      const target = await client.query<TargetRow>(
        "SELECT * FROM deployment_targets WHERE owner_id = $1 AND id = $2 FOR UPDATE",
        [ownerId, targetId],
      );
      if (!target.rows[0]) return undefined;

      await client.query(
        `INSERT INTO deployment_target_credentials
         (target_id, owner_id, kubeconfig_encrypted, key_version, fingerprint)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (target_id) DO UPDATE SET
           owner_id = EXCLUDED.owner_id,
           kubeconfig_encrypted = EXCLUDED.kubeconfig_encrypted,
           key_version = EXCLUDED.key_version,
           fingerprint = EXCLUDED.fingerprint,
           updated_at = now()`,
        [
          targetId,
          ownerId,
          input.encryptedKubeconfig,
          input.keyVersion,
          input.fingerprint,
        ],
      );
      const config: KubernetesTargetConfig = {
        connectionStatus: "connected",
        connection: input.connection,
        credentialStoredAt: input.storedAt,
      };
      const updated = await client.query<TargetRow>(
        `UPDATE deployment_targets
         SET config = $3, updated_at = now()
         WHERE owner_id = $1 AND id = $2
         RETURNING *`,
        [ownerId, targetId, JSON.stringify(config)],
      );
      return mapTarget(updated.rows[0]);
    });
  }

  async findCredential(
    ownerId: string,
    targetId: string,
  ): Promise<StoredKubernetesCredential | undefined> {
    const result = await this.database.query<CredentialRow>(
      `SELECT credential.*
       FROM deployment_target_credentials credential
       JOIN deployment_targets target ON target.id = credential.target_id
       WHERE credential.owner_id = $1 AND credential.target_id = $2
         AND target.owner_id = $1`,
      [ownerId, targetId],
    );
    return result.rows[0] ? mapCredential(result.rows[0]) : undefined;
  }

  async deleteCredential(
    ownerId: string,
    targetId: string,
  ): Promise<DeploymentTarget | undefined> {
    return withTransaction(this.database, async (client) => {
      const result = await client.query<TargetRow>(
        "SELECT * FROM deployment_targets WHERE owner_id = $1 AND id = $2 FOR UPDATE",
        [ownerId, targetId],
      );
      const target = result.rows[0];
      if (!target) return undefined;
      await client.query(
        "DELETE FROM deployment_target_credentials WHERE owner_id = $1 AND target_id = $2",
        [ownerId, targetId],
      );
      const current = normalizeTargetConfig(target.config);
      const config: KubernetesTargetConfig =
        current.connectionStatus === "draft"
          ? current
          : { connectionStatus: "inspected", connection: current.connection };
      const updated = await client.query<TargetRow>(
        `UPDATE deployment_targets
         SET config = $3, updated_at = now()
         WHERE owner_id = $1 AND id = $2
         RETURNING *`,
        [ownerId, targetId, JSON.stringify(config)],
      );
      return mapTarget(updated.rows[0]);
    });
  }
}

export class InMemoryDeploymentRepository implements DeploymentRepository {
  private readonly targets = new Map<
    string,
    DeploymentTarget & { ownerId: string }
  >();
  private readonly credentials = new Map<
    string,
    StoredKubernetesCredential & { ownerId: string }
  >();

  async create(
    ownerId: string,
    input: {
      projectId: string;
      name: string;
      environment: DeploymentEnvironment;
      config: KubernetesTargetConfig;
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
    return this.publicTarget(target);
  }

  async list(ownerId: string, projectId: string): Promise<DeploymentTarget[]> {
    return [...this.targets.values()]
      .filter(
        (target) =>
          target.ownerId === ownerId && target.projectId === projectId,
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((target) => this.publicTarget(target));
  }

  async find(
    ownerId: string,
    id: string,
  ): Promise<DeploymentTarget | undefined> {
    const target = this.targets.get(id);
    return target?.ownerId === ownerId ? this.publicTarget(target) : undefined;
  }

  async saveCredential(
    ownerId: string,
    targetId: string,
    input: {
      encryptedKubeconfig: string;
      keyVersion: "v1";
      fingerprint: string;
      connection: KubernetesConnectionSummary;
      storedAt: string;
    },
  ): Promise<DeploymentTarget | undefined> {
    const target = this.targets.get(targetId);
    if (!target || target.ownerId !== ownerId) return undefined;
    const existing = this.credentials.get(targetId);
    const now = new Date().toISOString();
    this.credentials.set(targetId, {
      targetId,
      ownerId,
      encryptedKubeconfig: input.encryptedKubeconfig,
      keyVersion: input.keyVersion,
      fingerprint: input.fingerprint,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    target.config = {
      connectionStatus: "connected",
      connection: structuredClone(input.connection),
      credentialStoredAt: input.storedAt,
    };
    target.updatedAt = now;
    return this.publicTarget(target);
  }

  async findCredential(
    ownerId: string,
    targetId: string,
  ): Promise<StoredKubernetesCredential | undefined> {
    const credential = this.credentials.get(targetId);
    if (!credential || credential.ownerId !== ownerId) return undefined;
    const { ownerId: _ownerId, ...publicCredential } = credential;
    return structuredClone(publicCredential);
  }

  async deleteCredential(
    ownerId: string,
    targetId: string,
  ): Promise<DeploymentTarget | undefined> {
    const target = this.targets.get(targetId);
    if (!target || target.ownerId !== ownerId) return undefined;
    this.credentials.delete(targetId);
    if (target.config.connectionStatus !== "draft") {
      target.config = {
        connectionStatus: "inspected",
        connection: structuredClone(target.config.connection),
      };
    }
    target.updatedAt = new Date().toISOString();
    return this.publicTarget(target);
  }

  private publicTarget(
    target: DeploymentTarget & { ownerId: string },
  ): DeploymentTarget {
    const { ownerId: _ownerId, ...publicTarget } = target;
    return structuredClone(publicTarget);
  }
}
