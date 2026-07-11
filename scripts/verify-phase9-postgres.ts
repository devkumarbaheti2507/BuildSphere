import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { loadEnvironment } from "@buildsphere/service-core";
import {
  createDatabasePool,
  type DatabasePool,
} from "@buildsphere/service-core/database";
import { KubernetesCredentialCipher } from "../backend/deployment-service/src/credential.js";
import { PostgresDeploymentOperationRepository } from "../backend/deployment-service/src/operation-repository.js";
import { PostgresDeploymentRepository } from "../backend/deployment-service/src/repository.js";

const repoRoot = process.env.INIT_CWD ?? path.resolve(process.cwd(), "../..");
loadEnvironment(path.join(repoRoot, ".env"));

const verify = async (database: DatabasePool): Promise<void> => {
  const ownerId = randomUUID();
  const projectId = randomUUID();
  const targets = new PostgresDeploymentRepository(database);
  const operations = new PostgresDeploymentOperationRepository(database);
  const target = await targets.create(ownerId, {
    projectId,
    name: `Phase 9 verification ${randomUUID()}`,
    environment: "development",
    config: {
      connectionStatus: "inspected",
      connection: {
        context: "phase9-verification",
        cluster: "phase9-verification",
        serverHost: "127.0.0.1:6443",
        namespace: "buildsphere-verification",
        credentialMechanism: "token",
        tlsVerification: "enabled",
        contextCount: 1,
      },
    },
  });

  try {
    const cipher = new KubernetesCredentialCipher(
      Buffer.alloc(32, 13).toString("base64"),
    );
    const plaintext = "phase9-postgres-verification-kubeconfig";
    if (target.config.connectionStatus === "draft") {
      throw new Error("Expected an inspected verification target");
    }
    const connected = await targets.saveCredential(ownerId, target.id, {
      encryptedKubeconfig: cipher.encrypt(plaintext, ownerId, target.id),
      keyVersion: "v1",
      fingerprint: "b".repeat(64),
      connection: target.config.connection,
      storedAt: "2026-07-11T12:00:00.000Z",
    });
    assert.equal(connected?.config.connectionStatus, "connected");
    const credential = await targets.findCredential(ownerId, target.id);
    assert.ok(credential);
    assert.equal(
      cipher.decrypt(credential.encryptedKubeconfig, ownerId, target.id),
      plaintext,
    );
    assert.equal(credential.encryptedKubeconfig.includes(plaintext), false);

    const firstArtifactId = randomUUID();
    const firstApproval = await operations.createApproval(ownerId, {
      targetId: target.id,
      projectId,
      artifactId: firstArtifactId,
      action: "apply",
      manifestDigest: "c".repeat(64),
      credentialFingerprint: "b".repeat(64),
      createdAt: "2026-07-11T12:00:00.000Z",
      expiresAt: "2026-07-11T12:05:00.000Z",
    });
    const firstClaim = await operations.claimOperation(ownerId, {
      approvalId: firstApproval.id,
      targetId: target.id,
      projectId,
      artifactId: firstArtifactId,
      kind: "apply",
      manifestDigest: "c".repeat(64),
      credentialFingerprint: "b".repeat(64),
      resources: [],
      idempotencyKey: randomUUID(),
      now: "2026-07-11T12:01:00.000Z",
    });
    await operations.updateOperation(ownerId, firstClaim.operation.id, {
      status: "succeeded",
      rolloutStatus: "healthy",
      finishedAt: "2026-07-11T12:01:30.000Z",
      updatedAt: "2026-07-11T12:01:30.000Z",
    });

    const secondArtifactId = randomUUID();
    const secondApproval = await operations.createApproval(ownerId, {
      targetId: target.id,
      projectId,
      artifactId: secondArtifactId,
      action: "apply",
      manifestDigest: "d".repeat(64),
      credentialFingerprint: "b".repeat(64),
      createdAt: "2026-07-11T12:02:00.000Z",
      expiresAt: "2026-07-11T12:07:00.000Z",
    });
    const secondKey = randomUUID();
    const secondInput = {
      approvalId: secondApproval.id,
      targetId: target.id,
      projectId,
      artifactId: secondArtifactId,
      kind: "apply",
      manifestDigest: "d".repeat(64),
      credentialFingerprint: "b".repeat(64),
      resources: [],
      idempotencyKey: secondKey,
      now: "2026-07-11T12:03:00.000Z",
    };
    const concurrentClaims = await Promise.all([
      operations.claimOperation(ownerId, secondInput),
      operations.claimOperation(ownerId, secondInput),
    ]);
    assert.equal(concurrentClaims.filter((claim) => claim.replayed).length, 1);
    assert.equal(
      concurrentClaims[0].operation.id,
      concurrentClaims[1].operation.id,
    );
    const secondClaim = concurrentClaims.find((claim) => !claim.replayed)!;
    await operations.updateOperation(ownerId, secondClaim.operation.id, {
      status: "succeeded",
      rolloutStatus: "progressing",
      updatedAt: "2026-07-11T12:03:30.000Z",
    });
    const replay = await operations.claimOperation(ownerId, {
      approvalId: secondApproval.id,
      targetId: target.id,
      projectId,
      artifactId: secondArtifactId,
      kind: "apply",
      manifestDigest: "d".repeat(64),
      credentialFingerprint: "b".repeat(64),
      resources: [],
      idempotencyKey: secondKey,
      now: "2026-07-11T12:04:00.000Z",
    });
    const previous = await operations.findPreviousSuccessfulApply(
      ownerId,
      target.id,
      secondClaim.operation.createdAt,
    );
    const rollbackApproval = await operations.createApproval(ownerId, {
      targetId: target.id,
      projectId,
      artifactId: firstArtifactId,
      action: "rollback",
      sourceOperationId: secondClaim.operation.id,
      manifestDigest: "c".repeat(64),
      credentialFingerprint: "b".repeat(64),
      createdAt: "2026-07-11T12:05:00.000Z",
      expiresAt: "2026-07-11T12:10:00.000Z",
    });
    const rollback = await operations.claimOperation(ownerId, {
      approvalId: rollbackApproval.id,
      targetId: target.id,
      projectId,
      artifactId: firstArtifactId,
      kind: "rollback",
      manifestDigest: "c".repeat(64),
      credentialFingerprint: "b".repeat(64),
      resources: [],
      rollbackOfId: secondClaim.operation.id,
      restoredOperationId: firstClaim.operation.id,
      idempotencyKey: randomUUID(),
      now: "2026-07-11T12:06:00.000Z",
    });
    await operations.updateOperation(ownerId, rollback.operation.id, {
      status: "rolled_back",
      updatedAt: "2026-07-11T12:06:30.000Z",
    });
    const activeRelease = await operations.findActiveRelease(
      ownerId,
      target.id,
    );
    const history = await operations.listOperations(ownerId, projectId);
    assert.equal(replay.replayed, true);
    assert.equal(replay.operation.id, secondClaim.operation.id);
    assert.equal(previous?.id, firstClaim.operation.id);
    assert.equal(activeRelease?.id, firstClaim.operation.id);
    assert.equal(history.length, 3);

    const counts = await database.query<{
      credentials: string;
      approvals: string;
      operations: string;
    }>(
      `SELECT
         (SELECT count(*) FROM deployment_target_credentials WHERE target_id = $1)::text AS credentials,
         (SELECT count(*) FROM deployment_approvals WHERE target_id = $1)::text AS approvals,
         (SELECT count(*) FROM deployment_operations WHERE target_id = $1)::text AS operations`,
      [target.id],
    );
    assert.deepEqual(counts.rows[0], {
      credentials: "1",
      approvals: "3",
      operations: "3",
    });
    console.log(
      JSON.stringify(
        {
          status: "passed",
          credentialRows: Number(counts.rows[0].credentials),
          approvalRows: Number(counts.rows[0].approvals),
          operationRows: Number(counts.rows[0].operations),
          idempotentReplay: replay.replayed,
          concurrentReplaySerialized: true,
          previousReleaseResolved: previous?.id === firstClaim.operation.id,
          activeReleaseRestored: activeRelease?.id === firstClaim.operation.id,
        },
        null,
        2,
      ),
    );
  } finally {
    await database.query("DELETE FROM deployment_targets WHERE id = $1", [
      target.id,
    ]);
    const remaining = await database.query<{ count: string }>(
      `SELECT (
         (SELECT count(*) FROM deployment_targets WHERE id = $1) +
         (SELECT count(*) FROM deployment_target_credentials WHERE target_id = $1) +
         (SELECT count(*) FROM deployment_approvals WHERE target_id = $1) +
         (SELECT count(*) FROM deployment_operations WHERE target_id = $1)
       )::text AS count`,
      [target.id],
    );
    assert.equal(remaining.rows[0].count, "0");
  }
};

const main = async (): Promise<void> => {
  const database = createDatabasePool();
  try {
    await verify(database);
  } finally {
    await database.end();
  }
};

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
