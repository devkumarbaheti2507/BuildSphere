import { randomUUID } from "node:crypto";
import type {
  KubernetesApprovalStatus,
  KubernetesDeploymentAction,
  KubernetesDeploymentApproval,
  KubernetesDeploymentOperation,
  KubernetesDeploymentOperationStatus,
  KubernetesOperationResource,
  KubernetesRolloutStatus,
} from "@buildsphere/shared-types";
import { withTransaction } from "@buildsphere/service-core/database";
import type { DatabasePool } from "@buildsphere/service-core/database";

export interface StoredDeploymentOperation extends KubernetesDeploymentOperation {
  ownerId: string;
  idempotencyKey: string;
  credentialFingerprint: string;
}

export interface StoredDeploymentApproval extends KubernetesDeploymentApproval {
  credentialFingerprint: string;
}

type OperationRepositoryErrorCode =
  | "DEPLOYMENT_APPROVAL_NOT_FOUND"
  | "DEPLOYMENT_APPROVAL_EXPIRED"
  | "DEPLOYMENT_APPROVAL_USED"
  | "DEPLOYMENT_APPROVAL_MISMATCH"
  | "DEPLOYMENT_IDEMPOTENCY_KEY_REUSED"
  | "DEPLOYMENT_TARGET_BUSY";

export class OperationRepositoryError extends Error {
  constructor(
    public readonly code: OperationRepositoryErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface DeploymentOperationRepository {
  createApproval(
    ownerId: string,
    input: {
      targetId: string;
      projectId: string;
      artifactId: string;
      action: KubernetesDeploymentAction;
      sourceOperationId?: string;
      manifestDigest: string;
      credentialFingerprint: string;
      expiresAt: string;
      createdAt: string;
    },
  ): Promise<StoredDeploymentApproval>;
  findApproval(
    ownerId: string,
    approvalId: string,
  ): Promise<StoredDeploymentApproval | undefined>;
  claimOperation(
    ownerId: string,
    input: {
      approvalId: string;
      targetId: string;
      projectId: string;
      artifactId: string;
      kind: KubernetesDeploymentAction;
      manifestDigest: string;
      credentialFingerprint: string;
      resources: KubernetesOperationResource[];
      rollbackOfId?: string;
      restoredOperationId?: string;
      idempotencyKey: string;
      now: string;
    },
  ): Promise<{ operation: StoredDeploymentOperation; replayed: boolean }>;
  updateOperation(
    ownerId: string,
    operationId: string,
    input: {
      status?: KubernetesDeploymentOperationStatus;
      rolloutStatus?: KubernetesRolloutStatus;
      resources?: KubernetesOperationResource[];
      errorCode?: string | null;
      errorMessage?: string | null;
      startedAt?: string;
      finishedAt?: string;
      updatedAt: string;
    },
  ): Promise<StoredDeploymentOperation | undefined>;
  findOperation(
    ownerId: string,
    operationId: string,
  ): Promise<StoredDeploymentOperation | undefined>;
  listOperations(
    ownerId: string,
    projectId: string,
  ): Promise<StoredDeploymentOperation[]>;
  findPreviousSuccessfulApply(
    ownerId: string,
    targetId: string,
    beforeCreatedAt: string,
  ): Promise<StoredDeploymentOperation | undefined>;
  findActiveRelease(
    ownerId: string,
    targetId: string,
  ): Promise<StoredDeploymentOperation | undefined>;
}

interface ApprovalRow {
  id: string;
  target_id: string;
  project_id: string;
  artifact_id: string;
  action: KubernetesDeploymentAction;
  source_operation_id: string | null;
  manifest_digest: string;
  credential_fingerprint: string;
  status: KubernetesApprovalStatus;
  expires_at: Date | string;
  consumed_at: Date | string | null;
  created_at: Date | string;
}

interface OperationRow {
  id: string;
  owner_id: string;
  target_id: string;
  project_id: string;
  artifact_id: string;
  approval_id: string;
  kind: KubernetesDeploymentAction;
  status: KubernetesDeploymentOperationStatus;
  rollout_status: KubernetesRolloutStatus;
  idempotency_key: string;
  manifest_digest: string;
  credential_fingerprint: string;
  resources: KubernetesOperationResource[];
  rollback_of_id: string | null;
  restored_operation_id: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const optionalIso = (value: Date | string | null): string | undefined =>
  value ? iso(value) : undefined;

const mapApproval = (row: ApprovalRow): StoredDeploymentApproval => ({
  id: row.id,
  targetId: row.target_id,
  projectId: row.project_id,
  artifactId: row.artifact_id,
  action: row.action,
  sourceOperationId: row.source_operation_id ?? undefined,
  manifestDigest: row.manifest_digest,
  credentialFingerprint: row.credential_fingerprint,
  status: row.status,
  expiresAt: iso(row.expires_at),
  consumedAt: optionalIso(row.consumed_at),
  createdAt: iso(row.created_at),
});

const mapOperation = (row: OperationRow): StoredDeploymentOperation => ({
  id: row.id,
  ownerId: row.owner_id,
  targetId: row.target_id,
  projectId: row.project_id,
  artifactId: row.artifact_id,
  approvalId: row.approval_id,
  kind: row.kind,
  status: row.status,
  rolloutStatus: row.rollout_status,
  idempotencyKey: row.idempotency_key,
  manifestDigest: row.manifest_digest,
  credentialFingerprint: row.credential_fingerprint,
  resources: row.resources,
  rollbackOfId: row.rollback_of_id ?? undefined,
  restoredOperationId: row.restored_operation_id ?? undefined,
  rollbackAvailable: false,
  errorCode: row.error_code ?? undefined,
  errorMessage: row.error_message ?? undefined,
  startedAt: optionalIso(row.started_at),
  finishedAt: optionalIso(row.finished_at),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

const exactReplay = (
  operation: StoredDeploymentOperation,
  input: Parameters<DeploymentOperationRepository["claimOperation"]>[1],
): boolean =>
  operation.targetId === input.targetId &&
  operation.projectId === input.projectId &&
  operation.artifactId === input.artifactId &&
  operation.approvalId === input.approvalId &&
  operation.kind === input.kind &&
  operation.manifestDigest === input.manifestDigest &&
  operation.credentialFingerprint === input.credentialFingerprint &&
  operation.rollbackOfId === input.rollbackOfId &&
  operation.restoredOperationId === input.restoredOperationId;

const assertApprovalMatches = (
  approval: StoredDeploymentApproval,
  input: Parameters<DeploymentOperationRepository["claimOperation"]>[1],
): void => {
  if (
    approval.targetId !== input.targetId ||
    approval.projectId !== input.projectId ||
    approval.artifactId !== input.artifactId ||
    approval.action !== input.kind ||
    approval.manifestDigest !== input.manifestDigest ||
    approval.credentialFingerprint !== input.credentialFingerprint ||
    approval.sourceOperationId !== input.rollbackOfId
  ) {
    throw new OperationRepositoryError(
      "DEPLOYMENT_APPROVAL_MISMATCH",
      "The deployment approval does not match this exact operation.",
    );
  }
};

const postgresConstraint = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "constraint" in error
    ? String((error as { constraint?: unknown }).constraint)
    : undefined;

export class PostgresDeploymentOperationRepository implements DeploymentOperationRepository {
  constructor(private readonly database: DatabasePool) {}

  async createApproval(
    ownerId: string,
    input: {
      targetId: string;
      projectId: string;
      artifactId: string;
      action: KubernetesDeploymentAction;
      sourceOperationId?: string;
      manifestDigest: string;
      credentialFingerprint: string;
      expiresAt: string;
      createdAt: string;
    },
  ): Promise<StoredDeploymentApproval> {
    const result = await this.database.query<ApprovalRow>(
      `INSERT INTO deployment_approvals
       (id, owner_id, target_id, project_id, artifact_id, action,
        source_operation_id, manifest_digest, credential_fingerprint,
        expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        randomUUID(),
        ownerId,
        input.targetId,
        input.projectId,
        input.artifactId,
        input.action,
        input.sourceOperationId ?? null,
        input.manifestDigest,
        input.credentialFingerprint,
        input.expiresAt,
        input.createdAt,
      ],
    );
    return mapApproval(result.rows[0]);
  }

  async findApproval(
    ownerId: string,
    approvalId: string,
  ): Promise<StoredDeploymentApproval | undefined> {
    const result = await this.database.query<ApprovalRow>(
      "SELECT * FROM deployment_approvals WHERE owner_id = $1 AND id = $2",
      [ownerId, approvalId],
    );
    return result.rows[0] ? mapApproval(result.rows[0]) : undefined;
  }

  async claimOperation(
    ownerId: string,
    input: Parameters<DeploymentOperationRepository["claimOperation"]>[1],
  ): Promise<{ operation: StoredDeploymentOperation; replayed: boolean }> {
    return withTransaction(this.database, async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`${ownerId}:${input.idempotencyKey}`],
      );
      const replay = await client.query<OperationRow>(
        `SELECT * FROM deployment_operations
         WHERE owner_id = $1 AND idempotency_key = $2 FOR UPDATE`,
        [ownerId, input.idempotencyKey],
      );
      if (replay.rows[0]) {
        const operation = mapOperation(replay.rows[0]);
        if (!exactReplay(operation, input)) {
          throw new OperationRepositoryError(
            "DEPLOYMENT_IDEMPOTENCY_KEY_REUSED",
            "The idempotency key was already used for a different operation.",
          );
        }
        return { operation, replayed: true };
      }

      const approvals = await client.query<ApprovalRow>(
        `SELECT * FROM deployment_approvals
         WHERE owner_id = $1 AND id = $2 FOR UPDATE`,
        [ownerId, input.approvalId],
      );
      if (!approvals.rows[0]) {
        throw new OperationRepositoryError(
          "DEPLOYMENT_APPROVAL_NOT_FOUND",
          "The deployment approval was not found.",
        );
      }
      const approval = mapApproval(approvals.rows[0]);
      if (approval.status !== "pending") {
        throw new OperationRepositoryError(
          "DEPLOYMENT_APPROVAL_USED",
          "The deployment approval is no longer available.",
        );
      }
      if (Date.parse(approval.expiresAt) <= Date.parse(input.now)) {
        throw new OperationRepositoryError(
          "DEPLOYMENT_APPROVAL_EXPIRED",
          "The deployment approval has expired.",
        );
      }
      assertApprovalMatches(approval, input);

      let inserted;
      try {
        inserted = await client.query<OperationRow>(
          `INSERT INTO deployment_operations
           (id, owner_id, target_id, project_id, artifact_id, approval_id,
            kind, idempotency_key, manifest_digest, credential_fingerprint, resources,
            rollback_of_id, restored_operation_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
           RETURNING *`,
          [
            randomUUID(),
            ownerId,
            input.targetId,
            input.projectId,
            input.artifactId,
            input.approvalId,
            input.kind,
            input.idempotencyKey,
            input.manifestDigest,
            input.credentialFingerprint,
            JSON.stringify(input.resources),
            input.rollbackOfId ?? null,
            input.restoredOperationId ?? null,
            input.now,
          ],
        );
      } catch (error) {
        if (
          postgresConstraint(error) ===
          "deployment_operations_one_active_target_idx"
        ) {
          throw new OperationRepositoryError(
            "DEPLOYMENT_TARGET_BUSY",
            "Another deployment operation is active for this target.",
          );
        }
        throw error;
      }
      await client.query(
        `UPDATE deployment_approvals
         SET status = 'consumed', consumed_at = $3
         WHERE owner_id = $1 AND id = $2`,
        [ownerId, input.approvalId, input.now],
      );
      return { operation: mapOperation(inserted.rows[0]), replayed: false };
    });
  }

  async updateOperation(
    ownerId: string,
    operationId: string,
    input: Parameters<DeploymentOperationRepository["updateOperation"]>[2],
  ): Promise<StoredDeploymentOperation | undefined> {
    const result = await this.database.query<OperationRow>(
      `UPDATE deployment_operations SET
         status = COALESCE($3, status),
         rollout_status = COALESCE($4, rollout_status),
         resources = COALESCE($5, resources),
         error_code = CASE WHEN $6::boolean THEN $7 ELSE error_code END,
         error_message = CASE WHEN $6::boolean THEN $8 ELSE error_message END,
         started_at = COALESCE($9, started_at),
         finished_at = COALESCE($10, finished_at),
         updated_at = $11
       WHERE owner_id = $1 AND id = $2
       RETURNING *`,
      [
        ownerId,
        operationId,
        input.status ?? null,
        input.rolloutStatus ?? null,
        input.resources ? JSON.stringify(input.resources) : null,
        input.errorCode !== undefined || input.errorMessage !== undefined,
        input.errorCode ?? null,
        input.errorMessage ?? null,
        input.startedAt ?? null,
        input.finishedAt ?? null,
        input.updatedAt,
      ],
    );
    return result.rows[0] ? mapOperation(result.rows[0]) : undefined;
  }

  async findOperation(
    ownerId: string,
    operationId: string,
  ): Promise<StoredDeploymentOperation | undefined> {
    const result = await this.database.query<OperationRow>(
      "SELECT * FROM deployment_operations WHERE owner_id = $1 AND id = $2",
      [ownerId, operationId],
    );
    return result.rows[0] ? mapOperation(result.rows[0]) : undefined;
  }

  async listOperations(
    ownerId: string,
    projectId: string,
  ): Promise<StoredDeploymentOperation[]> {
    const result = await this.database.query<OperationRow>(
      `SELECT * FROM deployment_operations
       WHERE owner_id = $1 AND project_id = $2
       ORDER BY created_at DESC`,
      [ownerId, projectId],
    );
    return result.rows.map(mapOperation);
  }

  async findPreviousSuccessfulApply(
    ownerId: string,
    targetId: string,
    beforeCreatedAt: string,
  ): Promise<StoredDeploymentOperation | undefined> {
    const result = await this.database.query<OperationRow>(
      `WITH latest_release_event AS (
         SELECT id, kind, restored_operation_id
         FROM deployment_operations
         WHERE owner_id = $1 AND target_id = $2 AND created_at < $3
           AND (
             (kind = 'apply' AND status = 'succeeded') OR
             (kind = 'rollback' AND status = 'rolled_back')
           )
         ORDER BY created_at DESC LIMIT 1
       )
       SELECT release.*
       FROM latest_release_event event
       JOIN deployment_operations release
         ON release.id = CASE
           WHEN event.kind = 'apply' THEN event.id
           ELSE event.restored_operation_id
         END`,
      [ownerId, targetId, beforeCreatedAt],
    );
    return result.rows[0] ? mapOperation(result.rows[0]) : undefined;
  }

  async findActiveRelease(
    ownerId: string,
    targetId: string,
  ): Promise<StoredDeploymentOperation | undefined> {
    const result = await this.database.query<OperationRow>(
      `WITH latest_release_event AS (
         SELECT id, kind, restored_operation_id
         FROM deployment_operations
         WHERE owner_id = $1 AND target_id = $2
           AND (
             (kind = 'apply' AND status = 'succeeded') OR
             (kind = 'rollback' AND status = 'rolled_back')
           )
         ORDER BY created_at DESC LIMIT 1
       )
       SELECT release.*
       FROM latest_release_event event
       JOIN deployment_operations release
         ON release.id = CASE
           WHEN event.kind = 'apply' THEN event.id
           ELSE event.restored_operation_id
         END`,
      [ownerId, targetId],
    );
    return result.rows[0] ? mapOperation(result.rows[0]) : undefined;
  }
}

interface MemoryApproval extends StoredDeploymentApproval {
  ownerId: string;
}

export class InMemoryDeploymentOperationRepository implements DeploymentOperationRepository {
  private readonly approvals = new Map<string, MemoryApproval>();
  private readonly operations = new Map<string, StoredDeploymentOperation>();

  async createApproval(
    ownerId: string,
    input: Parameters<DeploymentOperationRepository["createApproval"]>[1],
  ): Promise<StoredDeploymentApproval> {
    const approval: MemoryApproval = {
      id: randomUUID(),
      ownerId,
      targetId: input.targetId,
      projectId: input.projectId,
      artifactId: input.artifactId,
      action: input.action,
      sourceOperationId: input.sourceOperationId,
      manifestDigest: input.manifestDigest,
      credentialFingerprint: input.credentialFingerprint,
      status: "pending",
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
    };
    this.approvals.set(approval.id, approval);
    return this.publicApproval(approval);
  }

  async findApproval(
    ownerId: string,
    approvalId: string,
  ): Promise<StoredDeploymentApproval | undefined> {
    const approval = this.approvals.get(approvalId);
    return approval?.ownerId === ownerId
      ? this.publicApproval(approval)
      : undefined;
  }

  async claimOperation(
    ownerId: string,
    input: Parameters<DeploymentOperationRepository["claimOperation"]>[1],
  ): Promise<{ operation: StoredDeploymentOperation; replayed: boolean }> {
    const replay = [...this.operations.values()].find(
      (operation) =>
        operation.ownerId === ownerId &&
        operation.idempotencyKey === input.idempotencyKey,
    );
    if (replay) {
      if (!exactReplay(replay, input)) {
        throw new OperationRepositoryError(
          "DEPLOYMENT_IDEMPOTENCY_KEY_REUSED",
          "The idempotency key was already used for a different operation.",
        );
      }
      return { operation: structuredClone(replay), replayed: true };
    }

    const approval = this.approvals.get(input.approvalId);
    if (!approval || approval.ownerId !== ownerId) {
      throw new OperationRepositoryError(
        "DEPLOYMENT_APPROVAL_NOT_FOUND",
        "The deployment approval was not found.",
      );
    }
    if (approval.status !== "pending") {
      throw new OperationRepositoryError(
        "DEPLOYMENT_APPROVAL_USED",
        "The deployment approval is no longer available.",
      );
    }
    if (Date.parse(approval.expiresAt) <= Date.parse(input.now)) {
      approval.status = "expired";
      throw new OperationRepositoryError(
        "DEPLOYMENT_APPROVAL_EXPIRED",
        "The deployment approval has expired.",
      );
    }
    assertApprovalMatches(this.publicApproval(approval), input);
    const active = [...this.operations.values()].some(
      (operation) =>
        operation.targetId === input.targetId &&
        ["queued", "applying", "rolling_back"].includes(operation.status),
    );
    if (active) {
      throw new OperationRepositoryError(
        "DEPLOYMENT_TARGET_BUSY",
        "Another deployment operation is active for this target.",
      );
    }

    const operation: StoredDeploymentOperation = {
      id: randomUUID(),
      ownerId,
      targetId: input.targetId,
      projectId: input.projectId,
      artifactId: input.artifactId,
      approvalId: input.approvalId,
      kind: input.kind,
      status: "queued",
      rolloutStatus: "unknown",
      idempotencyKey: input.idempotencyKey,
      manifestDigest: input.manifestDigest,
      credentialFingerprint: input.credentialFingerprint,
      resources: structuredClone(input.resources),
      rollbackOfId: input.rollbackOfId,
      restoredOperationId: input.restoredOperationId,
      rollbackAvailable: false,
      createdAt: input.now,
      updatedAt: input.now,
    };
    approval.status = "consumed";
    approval.consumedAt = input.now;
    this.operations.set(operation.id, operation);
    return { operation: structuredClone(operation), replayed: false };
  }

  async updateOperation(
    ownerId: string,
    operationId: string,
    input: Parameters<DeploymentOperationRepository["updateOperation"]>[2],
  ): Promise<StoredDeploymentOperation | undefined> {
    const operation = this.operations.get(operationId);
    if (!operation || operation.ownerId !== ownerId) return undefined;
    if (input.status) operation.status = input.status;
    if (input.rolloutStatus) operation.rolloutStatus = input.rolloutStatus;
    if (input.resources) operation.resources = structuredClone(input.resources);
    if (input.errorCode !== undefined) {
      operation.errorCode = input.errorCode ?? undefined;
    }
    if (input.errorMessage !== undefined) {
      operation.errorMessage = input.errorMessage ?? undefined;
    }
    if (input.startedAt) operation.startedAt = input.startedAt;
    if (input.finishedAt) operation.finishedAt = input.finishedAt;
    operation.updatedAt = input.updatedAt;
    return structuredClone(operation);
  }

  async findOperation(
    ownerId: string,
    operationId: string,
  ): Promise<StoredDeploymentOperation | undefined> {
    const operation = this.operations.get(operationId);
    return operation?.ownerId === ownerId
      ? structuredClone(operation)
      : undefined;
  }

  async listOperations(
    ownerId: string,
    projectId: string,
  ): Promise<StoredDeploymentOperation[]> {
    return [...this.operations.values()]
      .filter(
        (operation) =>
          operation.ownerId === ownerId && operation.projectId === projectId,
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((operation) => structuredClone(operation));
  }

  async findPreviousSuccessfulApply(
    ownerId: string,
    targetId: string,
    beforeCreatedAt: string,
  ): Promise<StoredDeploymentOperation | undefined> {
    return this.effectiveRelease(ownerId, targetId, beforeCreatedAt);
  }

  async findActiveRelease(
    ownerId: string,
    targetId: string,
  ): Promise<StoredDeploymentOperation | undefined> {
    return this.effectiveRelease(ownerId, targetId);
  }

  private effectiveRelease(
    ownerId: string,
    targetId: string,
    beforeCreatedAt?: string,
  ): StoredDeploymentOperation | undefined {
    const event = [...this.operations.values()]
      .filter(
        (candidate) =>
          candidate.ownerId === ownerId &&
          candidate.targetId === targetId &&
          (!beforeCreatedAt || candidate.createdAt < beforeCreatedAt) &&
          ((candidate.kind === "apply" && candidate.status === "succeeded") ||
            (candidate.kind === "rollback" &&
              candidate.status === "rolled_back")),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    if (!event) return undefined;
    const release =
      event.kind === "apply"
        ? event
        : event.restoredOperationId
          ? this.operations.get(event.restoredOperationId)
          : undefined;
    return release ? structuredClone(release) : undefined;
  }

  private publicApproval(approval: MemoryApproval): StoredDeploymentApproval {
    const { ownerId: _ownerId, ...publicApproval } = approval;
    return structuredClone(publicApproval);
  }
}
