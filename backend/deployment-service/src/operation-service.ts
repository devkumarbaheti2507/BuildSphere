import type {
  DeploymentTarget,
  KubernetesDeploymentApproval,
  KubernetesDeploymentOperation,
  KubernetesExecutionCapabilities,
  KubernetesOperationResource,
} from "@buildsphere/shared-types";
import {
  NoopNotificationPublisher,
  type NotificationPublisher,
} from "@buildsphere/service-core";
import type { ProjectArtifactProvider } from "./artifact-provider.js";
import {
  ExecutionCredentialError,
  KubernetesCredentialCipher,
  prepareKubeconfigForExecution,
} from "./credential.js";
import {
  buildExecutableManifestBundle,
  type ExecutableManifestBundle,
} from "./executable-manifests.js";
import {
  executionCapabilities,
  type KubernetesExecutionConfiguration,
} from "./execution-policy.js";
import { KubernetesExecutionError, KubernetesExecutor } from "./executor.js";
import type { KubernetesResourceClientFactory } from "./kubernetes-client.js";
import {
  OperationRepositoryError,
  type DeploymentOperationRepository,
  type StoredDeploymentApproval,
  type StoredDeploymentOperation,
} from "./operation-repository.js";
import type { DeploymentRepository } from "./repository.js";

type DeploymentOperationServiceErrorCode =
  | "KUBERNETES_EXECUTION_DISABLED"
  | "DEPLOYMENT_TARGET_NOT_FOUND"
  | "DEPLOYMENT_OPERATION_NOT_FOUND"
  | "DEPLOYMENT_OPERATION_NOT_ROLLBACKABLE"
  | "DEPLOYMENT_ARTIFACT_PROJECT_MISMATCH"
  | "DEPLOYMENT_ARTIFACT_DIGEST_MISMATCH"
  | "KUBERNETES_CREDENTIAL_NOT_FOUND"
  | "KUBERNETES_ENVIRONMENT_NOT_ALLOWED"
  | OperationRepositoryError["code"]
  | ExecutionCredentialError["code"];

export class DeploymentOperationServiceError extends Error {
  constructor(
    public readonly code: DeploymentOperationServiceErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const publicOperation = (
  operation: StoredDeploymentOperation,
): KubernetesDeploymentOperation => {
  const {
    ownerId: _ownerId,
    idempotencyKey: _idempotencyKey,
    credentialFingerprint: _credentialFingerprint,
    ...result
  } = operation;
  return structuredClone(result);
};

const publicApproval = (
  approval: StoredDeploymentApproval,
): KubernetesDeploymentApproval => {
  const { credentialFingerprint: _credentialFingerprint, ...result } = approval;
  return structuredClone(result);
};

const repositoryError = (
  error: OperationRepositoryError,
): DeploymentOperationServiceError => {
  const status =
    error.code === "DEPLOYMENT_APPROVAL_NOT_FOUND"
      ? 404
      : error.code === "DEPLOYMENT_TARGET_BUSY"
        ? 409
        : 409;
  return new DeploymentOperationServiceError(error.code, error.message, status);
};

export class DeploymentOperationService {
  private readonly cipher?: KubernetesCredentialCipher;
  private readonly executor: KubernetesExecutor;

  constructor(
    private readonly targets: DeploymentRepository,
    private readonly operations: DeploymentOperationRepository,
    private readonly artifacts: ProjectArtifactProvider,
    private readonly clients: KubernetesResourceClientFactory,
    private readonly configuration: KubernetesExecutionConfiguration,
    private readonly notifications: NotificationPublisher = new NoopNotificationPublisher(),
    private readonly now: () => Date = () => new Date(),
    executor?: KubernetesExecutor,
  ) {
    this.cipher = configuration.encryptionKey
      ? new KubernetesCredentialCipher(configuration.encryptionKey)
      : undefined;
    this.executor =
      executor ??
      new KubernetesExecutor(configuration.policy, undefined, Date.now);
  }

  capabilities(): KubernetesExecutionCapabilities {
    return executionCapabilities(this.configuration);
  }

  async storeCredential(
    ownerId: string,
    targetId: string,
    kubeconfig: string,
  ): Promise<DeploymentTarget> {
    this.requireEnabled();
    const target = await this.target(ownerId, targetId);
    this.requireEnvironment(target);
    const prepared = prepareKubeconfigForExecution(
      kubeconfig,
      this.configuration.policy,
    );
    const storedAt = this.now().toISOString();
    const updated = await this.targets.saveCredential(ownerId, targetId, {
      encryptedKubeconfig: this.cipher!.encrypt(
        prepared.kubeconfig,
        ownerId,
        targetId,
      ),
      keyVersion: "v1",
      fingerprint: prepared.fingerprint,
      connection: prepared.connection,
      storedAt,
    });
    if (!updated) throw this.notFoundTarget();
    return updated;
  }

  async revokeCredential(
    ownerId: string,
    targetId: string,
  ): Promise<DeploymentTarget> {
    const target = await this.targets.deleteCredential(ownerId, targetId);
    if (!target) throw this.notFoundTarget();
    return target;
  }

  async createApplyApproval(
    ownerId: string,
    authorization: string,
    targetId: string,
    artifactId: string,
  ): Promise<KubernetesDeploymentApproval> {
    this.requireEnabled();
    const target = await this.target(ownerId, targetId);
    const credential = await this.credential(ownerId, target.id);
    const bundle = await this.artifactBundle(authorization, target, artifactId);
    const createdAt = this.now();
    return publicApproval(
      await this.operations.createApproval(ownerId, {
        targetId,
        projectId: target.projectId,
        artifactId,
        action: "apply",
        manifestDigest: bundle.digest,
        credentialFingerprint: credential.fingerprint,
        createdAt: createdAt.toISOString(),
        expiresAt: new Date(
          createdAt.getTime() +
            this.configuration.policy.approvalTtlSeconds * 1_000,
        ).toISOString(),
      }),
    );
  }

  async executeApply(
    ownerId: string,
    authorization: string,
    approvalId: string,
    idempotencyKey: string,
  ): Promise<KubernetesDeploymentOperation> {
    this.requireEnabled();
    const approval = await this.approval(ownerId, approvalId);
    if (approval.action !== "apply") {
      throw new DeploymentOperationServiceError(
        "DEPLOYMENT_APPROVAL_MISMATCH",
        "An apply operation requires an apply approval.",
        409,
      );
    }
    const target = await this.target(ownerId, approval.targetId);
    const credential = await this.credential(ownerId, target.id);
    const bundle = await this.artifactBundle(
      authorization,
      target,
      approval.artifactId,
    );
    let claimed;
    try {
      claimed = await this.operations.claimOperation(ownerId, {
        approvalId,
        targetId: target.id,
        projectId: target.projectId,
        artifactId: approval.artifactId,
        kind: "apply",
        manifestDigest: bundle.digest,
        credentialFingerprint: credential.fingerprint,
        resources: bundle.operationResources,
        idempotencyKey,
        now: this.now().toISOString(),
      });
    } catch (error) {
      if (error instanceof OperationRepositoryError)
        throw repositoryError(error);
      throw error;
    }
    if (claimed.replayed) {
      return this.withRollbackAvailability(ownerId, claimed.operation);
    }
    return this.runApply(ownerId, target, claimed.operation, bundle);
  }

  async list(
    ownerId: string,
    projectId: string,
  ): Promise<KubernetesDeploymentOperation[]> {
    const operations = await this.operations.listOperations(ownerId, projectId);
    return Promise.all(
      operations.map((operation) =>
        this.withRollbackAvailability(ownerId, operation),
      ),
    );
  }

  async get(
    ownerId: string,
    operationId: string,
  ): Promise<KubernetesDeploymentOperation> {
    return this.withRollbackAvailability(
      ownerId,
      await this.operation(ownerId, operationId),
    );
  }

  async refresh(
    ownerId: string,
    authorization: string,
    operationId: string,
  ): Promise<KubernetesDeploymentOperation> {
    this.requireEnabled();
    const operation = await this.operation(ownerId, operationId);
    const target = await this.target(ownerId, operation.targetId);
    const bundle = await this.artifactBundle(
      authorization,
      target,
      operation.artifactId,
    );
    this.requireDigest(operation, bundle);
    const client = await this.client(ownerId, target);
    try {
      const result = await this.executor.observe(client, bundle, {
        ownerId,
        projectId: target.projectId,
        targetId: target.id,
        operationId: operation.id,
        artifactId: operation.artifactId,
      });
      const deleted = operation.resources.filter(
        (resource) =>
          resource.action === "delete" && resource.status === "deleted",
      );
      const updated = await this.operations.updateOperation(
        ownerId,
        operation.id,
        {
          rolloutStatus: result.rolloutStatus,
          resources: [...result.resources, ...deleted],
          updatedAt: this.now().toISOString(),
        },
      );
      if (!updated) throw this.notFoundOperation();
      return this.withRollbackAvailability(ownerId, updated);
    } catch (error) {
      if (error instanceof KubernetesExecutionError) {
        const updated = await this.operations.updateOperation(
          ownerId,
          operation.id,
          {
            rolloutStatus: "degraded",
            resources: error.resources.length
              ? error.resources
              : operation.resources,
            errorCode: error.code,
            errorMessage: error.message,
            updatedAt: this.now().toISOString(),
          },
        );
        if (updated) return this.withRollbackAvailability(ownerId, updated);
      }
      throw error;
    }
  }

  async createRollbackApproval(
    ownerId: string,
    operationId: string,
  ): Promise<KubernetesDeploymentApproval> {
    this.requireEnabled();
    const current = await this.operation(ownerId, operationId);
    if (current.kind !== "apply" || current.status !== "succeeded") {
      throw this.notRollbackable();
    }
    await this.requireActiveRelease(ownerId, current);
    const previous = await this.operations.findPreviousSuccessfulApply(
      ownerId,
      current.targetId,
      current.createdAt,
    );
    if (!previous) throw this.notRollbackable();
    const target = await this.target(ownerId, current.targetId);
    const credential = await this.credential(ownerId, target.id);
    const createdAt = this.now();
    return publicApproval(
      await this.operations.createApproval(ownerId, {
        targetId: current.targetId,
        projectId: current.projectId,
        artifactId: previous.artifactId,
        action: "rollback",
        sourceOperationId: current.id,
        manifestDigest: previous.manifestDigest,
        credentialFingerprint: credential.fingerprint,
        createdAt: createdAt.toISOString(),
        expiresAt: new Date(
          createdAt.getTime() +
            this.configuration.policy.approvalTtlSeconds * 1_000,
        ).toISOString(),
      }),
    );
  }

  async executeRollback(
    ownerId: string,
    authorization: string,
    operationId: string,
    approvalId: string,
    idempotencyKey: string,
  ): Promise<KubernetesDeploymentOperation> {
    this.requireEnabled();
    const current = await this.operation(ownerId, operationId);
    if (current.kind !== "apply" || current.status !== "succeeded") {
      throw this.notRollbackable();
    }
    await this.requireActiveRelease(ownerId, current);
    const previous = await this.operations.findPreviousSuccessfulApply(
      ownerId,
      current.targetId,
      current.createdAt,
    );
    if (!previous) throw this.notRollbackable();
    const target = await this.target(ownerId, current.targetId);
    const credential = await this.credential(ownerId, target.id);
    const currentBundle = await this.artifactBundle(
      authorization,
      target,
      current.artifactId,
    );
    const previousBundle = await this.artifactBundle(
      authorization,
      target,
      previous.artifactId,
    );
    this.requireDigest(current, currentBundle);
    this.requireDigest(previous, previousBundle);
    const previousKeys = new Set(
      previousBundle.resources.map(({ identity }) =>
        [
          identity.apiVersion,
          identity.kind,
          identity.namespace ?? "",
          identity.name,
        ].join("|"),
      ),
    );
    const removed: KubernetesOperationResource[] = currentBundle.resources
      .filter(
        ({ identity }) =>
          !previousKeys.has(
            [
              identity.apiVersion,
              identity.kind,
              identity.namespace ?? "",
              identity.name,
            ].join("|"),
          ),
      )
      .map(({ identity }, index) => ({
        order: previousBundle.operationResources.length + index + 1,
        apiVersion: identity.apiVersion,
        kind: identity.kind,
        name: identity.name,
        namespace: identity.namespace,
        scope: identity.scope,
        action: "delete",
        status: "pending",
        attempts: 0,
      }));
    let claimed;
    try {
      claimed = await this.operations.claimOperation(ownerId, {
        approvalId,
        targetId: target.id,
        projectId: target.projectId,
        artifactId: previous.artifactId,
        kind: "rollback",
        manifestDigest: previousBundle.digest,
        credentialFingerprint: credential.fingerprint,
        resources: [...previousBundle.operationResources, ...removed],
        rollbackOfId: current.id,
        restoredOperationId: previous.id,
        idempotencyKey,
        now: this.now().toISOString(),
      });
    } catch (error) {
      if (error instanceof OperationRepositoryError)
        throw repositoryError(error);
      throw error;
    }
    if (claimed.replayed) return publicOperation(claimed.operation);
    return this.runRollback(
      ownerId,
      target,
      claimed.operation,
      currentBundle,
      previousBundle,
    );
  }

  private async runApply(
    ownerId: string,
    target: DeploymentTarget,
    operation: StoredDeploymentOperation,
    bundle: ExecutableManifestBundle,
  ): Promise<KubernetesDeploymentOperation> {
    const startedAt = this.now().toISOString();
    await this.operations.updateOperation(ownerId, operation.id, {
      status: "applying",
      startedAt,
      errorCode: null,
      errorMessage: null,
      updatedAt: startedAt,
    });
    try {
      const client = await this.client(
        ownerId,
        target,
        operation.credentialFingerprint,
      );
      const result = await this.executor.apply(client, bundle, {
        ownerId,
        projectId: target.projectId,
        targetId: target.id,
        operationId: operation.id,
        artifactId: operation.artifactId,
      });
      const finishedAt = this.now().toISOString();
      const updated = await this.operations.updateOperation(
        ownerId,
        operation.id,
        {
          status: "succeeded",
          rolloutStatus: result.rolloutStatus,
          resources: result.resources,
          finishedAt,
          updatedAt: finishedAt,
        },
      );
      if (!updated) throw this.notFoundOperation();
      await this.notifications.publish({
        userId: ownerId,
        type: "deployment.succeeded",
        title: "Kubernetes deployment applied",
        message: `${target.name} accepted ${result.resources.length} approved resources.`,
        metadata: {
          projectId: target.projectId,
          targetId: target.id,
          operationId: operation.id,
        },
      });
      return this.withRollbackAvailability(ownerId, updated);
    } catch (error) {
      return this.failOperation(ownerId, target, operation, error, false);
    }
  }

  private async runRollback(
    ownerId: string,
    target: DeploymentTarget,
    operation: StoredDeploymentOperation,
    current: ExecutableManifestBundle,
    previous: ExecutableManifestBundle,
  ): Promise<KubernetesDeploymentOperation> {
    const startedAt = this.now().toISOString();
    await this.operations.updateOperation(ownerId, operation.id, {
      status: "rolling_back",
      startedAt,
      errorCode: null,
      errorMessage: null,
      updatedAt: startedAt,
    });
    try {
      const client = await this.client(
        ownerId,
        target,
        operation.credentialFingerprint,
      );
      const result = await this.executor.rollback(client, current, previous, {
        ownerId,
        projectId: target.projectId,
        targetId: target.id,
        operationId: operation.id,
        artifactId: operation.artifactId,
      });
      const finishedAt = this.now().toISOString();
      const updated = await this.operations.updateOperation(
        ownerId,
        operation.id,
        {
          status: "rolled_back",
          rolloutStatus: result.rolloutStatus,
          resources: result.resources,
          finishedAt,
          updatedAt: finishedAt,
        },
      );
      if (!updated) throw this.notFoundOperation();
      await this.notifications.publish({
        userId: ownerId,
        type: "deployment.rolled_back",
        title: "Kubernetes deployment rolled back",
        message: `${target.name} restored the prior approved release.`,
        metadata: {
          projectId: target.projectId,
          targetId: target.id,
          operationId: operation.id,
          rollbackOfId: operation.rollbackOfId,
        },
      });
      return publicOperation(updated);
    } catch (error) {
      return this.failOperation(ownerId, target, operation, error, true);
    }
  }

  private async failOperation(
    ownerId: string,
    target: DeploymentTarget,
    operation: StoredDeploymentOperation,
    error: unknown,
    rollback: boolean,
  ): Promise<KubernetesDeploymentOperation> {
    const executionError =
      error instanceof KubernetesExecutionError ||
      error instanceof ExecutionCredentialError ||
      error instanceof DeploymentOperationServiceError
        ? error
        : new KubernetesExecutionError(
            "KUBERNETES_REQUEST_FAILED",
            "The Kubernetes operation failed.",
            operation.resources,
          );
    const resources =
      executionError instanceof KubernetesExecutionError &&
      executionError.resources.length
        ? executionError.resources
        : operation.resources;
    const finishedAt = this.now().toISOString();
    const updated = await this.operations.updateOperation(
      ownerId,
      operation.id,
      {
        status: rollback ? "rollback_failed" : "failed",
        rolloutStatus: "degraded",
        resources,
        errorCode: executionError.code,
        errorMessage: executionError.message,
        finishedAt,
        updatedAt: finishedAt,
      },
    );
    if (!updated) throw this.notFoundOperation();
    await this.notifications.publish({
      userId: ownerId,
      type: "deployment.failed",
      title: rollback
        ? "Kubernetes rollback failed"
        : "Kubernetes deployment failed",
      message: `${target.name} stopped with ${executionError.code}.`,
      metadata: {
        projectId: target.projectId,
        targetId: target.id,
        operationId: operation.id,
        errorCode: executionError.code,
      },
    });
    return publicOperation(updated);
  }

  private async artifactBundle(
    authorization: string,
    target: DeploymentTarget,
    artifactId: string,
  ): Promise<ExecutableManifestBundle> {
    this.requireEnvironment(target);
    const artifact = await this.artifacts.getOwnedArtifact(
      authorization,
      artifactId,
    );
    if (artifact.projectId !== target.projectId) {
      throw new DeploymentOperationServiceError(
        "DEPLOYMENT_ARTIFACT_PROJECT_MISMATCH",
        "The generated artifact does not belong to this deployment target.",
        409,
      );
    }
    return buildExecutableManifestBundle(target, artifact.files, true);
  }

  private requireDigest(
    operation: StoredDeploymentOperation,
    bundle: ExecutableManifestBundle,
  ): void {
    if (operation.manifestDigest !== bundle.digest) {
      throw new DeploymentOperationServiceError(
        "DEPLOYMENT_ARTIFACT_DIGEST_MISMATCH",
        "The immutable deployment artifact no longer matches its operation digest.",
        409,
      );
    }
  }

  private async credential(ownerId: string, targetId: string) {
    const credential = await this.targets.findCredential(ownerId, targetId);
    if (!credential) {
      throw new DeploymentOperationServiceError(
        "KUBERNETES_CREDENTIAL_NOT_FOUND",
        "The Kubernetes credential is unavailable or was revoked.",
        409,
      );
    }
    return credential;
  }

  private async client(
    ownerId: string,
    target: DeploymentTarget,
    expectedFingerprint?: string,
  ) {
    const credential = await this.credential(ownerId, target.id);
    if (expectedFingerprint && credential.fingerprint !== expectedFingerprint) {
      throw new DeploymentOperationServiceError(
        "DEPLOYMENT_APPROVAL_MISMATCH",
        "The Kubernetes credential changed after this operation was approved.",
        409,
      );
    }
    const kubeconfig = this.cipher!.decrypt(
      credential.encryptedKubeconfig,
      ownerId,
      target.id,
    );
    const prepared = prepareKubeconfigForExecution(
      kubeconfig,
      this.configuration.policy,
    );
    if (
      prepared.fingerprint !== credential.fingerprint ||
      prepared.connection.serverHost !==
        (target.config.connectionStatus === "draft"
          ? ""
          : target.config.connection.serverHost)
    ) {
      throw new ExecutionCredentialError(
        "KUBERNETES_CREDENTIAL_INVALID",
        "The stored Kubernetes credential no longer matches this target.",
      );
    }
    return this.clients.create(prepared.kubeconfig);
  }

  private async withRollbackAvailability(
    ownerId: string,
    operation: StoredDeploymentOperation,
  ): Promise<KubernetesDeploymentOperation> {
    const rollbackAvailable =
      operation.kind === "apply" &&
      operation.status === "succeeded" &&
      (await this.operations.findActiveRelease(ownerId, operation.targetId))
        ?.id === operation.id &&
      Boolean(
        await this.operations.findPreviousSuccessfulApply(
          ownerId,
          operation.targetId,
          operation.createdAt,
        ),
      );
    return publicOperation({ ...operation, rollbackAvailable });
  }

  private async requireActiveRelease(
    ownerId: string,
    operation: StoredDeploymentOperation,
  ): Promise<void> {
    const active = await this.operations.findActiveRelease(
      ownerId,
      operation.targetId,
    );
    if (active?.id !== operation.id) throw this.notRollbackable();
  }

  private async target(ownerId: string, targetId: string) {
    const target = await this.targets.find(ownerId, targetId);
    if (!target) throw this.notFoundTarget();
    return target;
  }

  private async operation(ownerId: string, operationId: string) {
    const operation = await this.operations.findOperation(ownerId, operationId);
    if (!operation) throw this.notFoundOperation();
    return operation;
  }

  private async approval(ownerId: string, approvalId: string) {
    const approval = await this.operations.findApproval(ownerId, approvalId);
    if (!approval) {
      throw new DeploymentOperationServiceError(
        "DEPLOYMENT_APPROVAL_NOT_FOUND",
        "The deployment approval was not found.",
        404,
      );
    }
    return approval;
  }

  private requireEnabled(): void {
    if (!this.configuration.enabled || !this.cipher) {
      throw new DeploymentOperationServiceError(
        "KUBERNETES_EXECUTION_DISABLED",
        "Kubernetes execution is not configured for this BuildSphere instance.",
        503,
      );
    }
  }

  private requireEnvironment(target: DeploymentTarget): void {
    if (
      !this.configuration.policy.allowedEnvironments.has(target.environment)
    ) {
      throw new DeploymentOperationServiceError(
        "KUBERNETES_ENVIRONMENT_NOT_ALLOWED",
        "This target environment is not enabled for Kubernetes execution.",
        403,
      );
    }
  }

  private notFoundTarget() {
    return new DeploymentOperationServiceError(
      "DEPLOYMENT_TARGET_NOT_FOUND",
      "The deployment target was not found.",
      404,
    );
  }

  private notFoundOperation() {
    return new DeploymentOperationServiceError(
      "DEPLOYMENT_OPERATION_NOT_FOUND",
      "The deployment operation was not found.",
      404,
    );
  }

  private notRollbackable() {
    return new DeploymentOperationServiceError(
      "DEPLOYMENT_OPERATION_NOT_ROLLBACKABLE",
      "Rollback requires a successful apply with a prior successful release.",
      409,
    );
  }
}
