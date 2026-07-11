import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  InMemoryDeploymentOperationRepository,
  OperationRepositoryError,
} from "./operation-repository.js";

const base = {
  targetId: "6033a3af-cf7a-4829-9156-1cc13b204c21",
  projectId: "ea72c362-4337-4cf9-beab-3b127e894240",
  artifactId: "fe57dcf6-9761-49ed-8b5f-ac145929e061",
  action: "apply" as const,
  manifestDigest: "a".repeat(64),
  credentialFingerprint: "f".repeat(64),
  createdAt: "2026-07-11T12:00:00.000Z",
  expiresAt: "2026-07-11T12:05:00.000Z",
};

const operationInput = (approvalId: string, idempotencyKey: string) => ({
  approvalId,
  targetId: base.targetId,
  projectId: base.projectId,
  artifactId: base.artifactId,
  kind: "apply" as const,
  manifestDigest: base.manifestDigest,
  credentialFingerprint: base.credentialFingerprint,
  resources: [],
  idempotencyKey,
  now: "2026-07-11T12:01:00.000Z",
});

test("operation claims consume approvals and replay exact idempotency keys", async () => {
  const repository = new InMemoryDeploymentOperationRepository();
  const approval = await repository.createApproval("owner", base);
  const input = operationInput(
    approval.id,
    "6c1be81c-4aaa-437b-b0dc-e934b40906bc",
  );
  const first = await repository.claimOperation("owner", input);
  const replay = await repository.claimOperation("owner", input);
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.operation.id, first.operation.id);

  const anotherApproval = await repository.createApproval("owner", base);
  await assert.rejects(
    repository.claimOperation("owner", {
      ...operationInput(anotherApproval.id, input.idempotencyKey),
    }),
    (error: unknown) =>
      error instanceof OperationRepositoryError &&
      error.code === "DEPLOYMENT_IDEMPOTENCY_KEY_REUSED",
  );
});

test("expired approvals and concurrent target operations are rejected", async () => {
  const repository = new InMemoryDeploymentOperationRepository();
  const expired = await repository.createApproval("owner", {
    ...base,
    expiresAt: "2026-07-11T12:00:30.000Z",
  });
  await assert.rejects(
    repository.claimOperation(
      "owner",
      operationInput(expired.id, "2f25367e-649c-45c8-a213-e7487bfc88ad"),
    ),
    (error: unknown) =>
      error instanceof OperationRepositoryError &&
      error.code === "DEPLOYMENT_APPROVAL_EXPIRED",
  );

  const first = await repository.createApproval("owner", base);
  await repository.claimOperation(
    "owner",
    operationInput(first.id, "2fc13aa8-cbb7-4318-a8f3-e6127a0ab51f"),
  );
  const second = await repository.createApproval("owner", base);
  await assert.rejects(
    repository.claimOperation(
      "owner",
      operationInput(second.id, "c0f3bcf1-8e9e-44c2-89ee-7dbdce2cd565"),
    ),
    (error: unknown) =>
      error instanceof OperationRepositoryError &&
      error.code === "DEPLOYMENT_TARGET_BUSY",
  );
});

test("active release resolution follows successful rollback history", async () => {
  const repository = new InMemoryDeploymentOperationRepository();
  const claimApply = async (
    artifactId: string,
    digest: string,
    createdAt: string,
    expiresAt: string,
  ) => {
    const approval = await repository.createApproval("owner", {
      ...base,
      artifactId,
      manifestDigest: digest,
      createdAt,
      expiresAt,
    });
    const claimed = await repository.claimOperation("owner", {
      ...operationInput(approval.id, randomUUID()),
      artifactId,
      manifestDigest: digest,
      now: new Date(Date.parse(createdAt) + 1_000).toISOString(),
    });
    await repository.updateOperation("owner", claimed.operation.id, {
      status: "succeeded",
      updatedAt: new Date(Date.parse(createdAt) + 2_000).toISOString(),
    });
    return claimed.operation;
  };

  const releaseA = await claimApply(
    "0fe6205f-438f-48b5-ab06-b11b0359e6b3",
    "a".repeat(64),
    "2026-07-11T12:00:00.000Z",
    "2026-07-11T12:05:00.000Z",
  );
  const releaseB = await claimApply(
    "d056e9e8-a0aa-4487-8d51-30dd6b99eb1d",
    "b".repeat(64),
    "2026-07-11T12:10:00.000Z",
    "2026-07-11T12:15:00.000Z",
  );
  const rollbackApproval = await repository.createApproval("owner", {
    ...base,
    artifactId: releaseA.artifactId,
    action: "rollback",
    sourceOperationId: releaseB.id,
    manifestDigest: releaseA.manifestDigest,
    createdAt: "2026-07-11T12:20:00.000Z",
    expiresAt: "2026-07-11T12:25:00.000Z",
  });
  const rollback = await repository.claimOperation("owner", {
    approvalId: rollbackApproval.id,
    targetId: base.targetId,
    projectId: base.projectId,
    artifactId: releaseA.artifactId,
    kind: "rollback",
    manifestDigest: releaseA.manifestDigest,
    credentialFingerprint: base.credentialFingerprint,
    resources: [],
    rollbackOfId: releaseB.id,
    restoredOperationId: releaseA.id,
    idempotencyKey: randomUUID(),
    now: "2026-07-11T12:21:00.000Z",
  });
  await repository.updateOperation("owner", rollback.operation.id, {
    status: "rolled_back",
    updatedAt: "2026-07-11T12:22:00.000Z",
  });
  assert.equal(
    (await repository.findActiveRelease("owner", base.targetId))?.id,
    releaseA.id,
  );

  const releaseC = await claimApply(
    "c22d42b0-8a41-480f-9a7e-75d6828bb6e2",
    "c".repeat(64),
    "2026-07-11T12:30:00.000Z",
    "2026-07-11T12:35:00.000Z",
  );
  assert.equal(
    (
      await repository.findPreviousSuccessfulApply(
        "owner",
        base.targetId,
        releaseC.createdAt,
      )
    )?.id,
    releaseA.id,
  );
});
