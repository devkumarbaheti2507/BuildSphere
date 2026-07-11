import type { KubernetesObject } from "@kubernetes/client-node";
import type {
  KubernetesOperationResource,
  KubernetesOperationResourceStatus,
  KubernetesRolloutStatus,
} from "@buildsphere/shared-types";
import type {
  ExecutableManifestBundle,
  ExecutableResource,
} from "./executable-manifests.js";
import type { KubernetesExecutionPolicy } from "./execution-policy.js";
import {
  KubernetesRequestError,
  type KubernetesResourceClient,
} from "./kubernetes-client.js";

const ownershipLabelKeys = {
  manager: "app.kubernetes.io/managed-by",
  owner: "buildsphere.dev/owner-id",
  project: "buildsphere.dev/project-id",
  target: "buildsphere.dev/target-id",
} as const;

export interface DeploymentOwnership {
  ownerId: string;
  projectId: string;
  targetId: string;
  operationId: string;
  artifactId: string;
}

export class KubernetesExecutionError extends Error {
  constructor(
    public readonly code:
      | "KUBERNETES_OPERATION_TIMEOUT"
      | "KUBERNETES_RESOURCE_OWNERSHIP_CONFLICT"
      | "KUBERNETES_ROLLBACK_DELETE_FORBIDDEN"
      | KubernetesRequestError["code"],
    message: string,
    public readonly resources: KubernetesOperationResource[],
  ) {
    super(message);
  }
}

interface AttemptResult<T> {
  value: T;
  attempts: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const resourceReference = (resource: ExecutableResource): KubernetesObject => ({
  apiVersion: resource.identity.apiVersion,
  kind: resource.identity.kind,
  metadata: {
    name: resource.identity.name,
    namespace: resource.identity.namespace,
  },
});

const expectedLabels = (
  ownership: DeploymentOwnership,
): Record<string, string> => ({
  [ownershipLabelKeys.manager]: "buildsphere",
  [ownershipLabelKeys.owner]: ownership.ownerId,
  [ownershipLabelKeys.project]: ownership.projectId,
  [ownershipLabelKeys.target]: ownership.targetId,
});

const withOwnership = (
  resource: KubernetesObject,
  ownership: DeploymentOwnership,
): KubernetesObject => {
  const manifest = structuredClone(resource);
  manifest.metadata = manifest.metadata ?? {};
  manifest.metadata.labels = {
    ...(manifest.metadata.labels ?? {}),
    ...expectedLabels(ownership),
  };
  manifest.metadata.annotations = {
    ...(manifest.metadata.annotations ?? {}),
    "buildsphere.dev/operation-id": ownership.operationId,
    "buildsphere.dev/artifact-id": ownership.artifactId,
  };
  return manifest;
};

const isOwned = (
  resource: KubernetesObject,
  ownership: DeploymentOwnership,
): boolean => {
  const labels = resource.metadata?.labels ?? {};
  return Object.entries(expectedLabels(ownership)).every(
    ([key, value]) => labels[key] === value,
  );
};

const operationResource = (
  resource: ExecutableResource,
  status: KubernetesOperationResourceStatus = "pending",
  attempts = 0,
  action: "apply" | "delete" = "apply",
  message?: string,
): KubernetesOperationResource => ({
  order: resource.identity.order,
  apiVersion: resource.identity.apiVersion,
  kind: resource.identity.kind,
  name: resource.identity.name,
  namespace: resource.identity.namespace,
  scope: resource.identity.scope,
  action,
  status,
  attempts,
  message,
});

const resourceKey = (resource: ExecutableResource): string =>
  [
    resource.identity.apiVersion,
    resource.identity.kind,
    resource.identity.namespace ?? "",
    resource.identity.name,
  ].join("|");

const numberAt = (value: unknown, key: string, fallback = 0): number =>
  isRecord(value) && typeof value[key] === "number"
    ? Number(value[key])
    : fallback;

const rolloutState = (
  resource: KubernetesObject,
): KubernetesOperationResourceStatus => {
  const object = resource as KubernetesObject & {
    spec?: unknown;
    status?: unknown;
  };
  const spec = isRecord(object.spec) ? object.spec : {};
  const status = isRecord(object.status) ? object.status : {};
  const metadata = isRecord(resource.metadata) ? resource.metadata : {};
  const observed = numberAt(status, "observedGeneration", -1);
  const generation = numberAt(metadata, "generation", 0);

  if (resource.kind === "Deployment") {
    const conditions = Array.isArray(status.conditions)
      ? status.conditions.filter(isRecord)
      : [];
    if (
      conditions.some(
        (condition) =>
          condition.type === "Progressing" &&
          condition.status === "False" &&
          condition.reason === "ProgressDeadlineExceeded",
      )
    ) {
      return "degraded";
    }
    const desired = numberAt(spec, "replicas", 1);
    return observed >= generation &&
      numberAt(status, "availableReplicas") >= desired
      ? "ready"
      : "progressing";
  }
  if (resource.kind === "StatefulSet") {
    const desired = numberAt(spec, "replicas", 1);
    return observed >= generation &&
      numberAt(status, "readyReplicas") >= desired &&
      status.currentRevision === status.updateRevision
      ? "ready"
      : "progressing";
  }
  if (resource.kind === "DaemonSet") {
    return observed >= generation &&
      numberAt(status, "numberReady") >=
        numberAt(status, "desiredNumberScheduled", 1)
      ? "ready"
      : "progressing";
  }
  if (resource.kind === "Job") {
    if (numberAt(status, "failed") > 0) return "degraded";
    return numberAt(status, "succeeded") > 0 ? "ready" : "progressing";
  }
  return "present";
};

export interface KubernetesApplyResult {
  resources: KubernetesOperationResource[];
  rolloutStatus: KubernetesRolloutStatus;
}

export class KubernetesExecutor {
  constructor(
    private readonly policy: KubernetesExecutionPolicy,
    private readonly sleep: (milliseconds: number) => Promise<void> = (
      milliseconds,
    ) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    private readonly now: () => number = Date.now,
  ) {}

  async apply(
    client: KubernetesResourceClient,
    bundle: ExecutableManifestBundle,
    ownership: DeploymentOwnership,
  ): Promise<KubernetesApplyResult> {
    return this.applyBeforeDeadline(
      client,
      bundle,
      ownership,
      this.now() + this.policy.operationTimeoutMs,
    );
  }

  async observe(
    client: KubernetesResourceClient,
    bundle: ExecutableManifestBundle,
    ownership: DeploymentOwnership,
  ): Promise<KubernetesApplyResult> {
    const deadline = this.now() + this.policy.operationTimeoutMs;
    const outcomes: KubernetesOperationResource[] = [];
    for (const resource of bundle.resources) {
      try {
        const read = await this.attempt(
          () => client.read(resourceReference(resource)),
          deadline,
        );
        if (!read.value) {
          outcomes.push({
            ...operationResource(resource, "missing", read.attempts),
            observedAt: new Date(this.now()).toISOString(),
          });
          continue;
        }
        const state =
          resource.identity.kind === "Namespace" ||
          isOwned(read.value, ownership)
            ? rolloutState(read.value)
            : "degraded";
        outcomes.push({
          ...operationResource(
            resource,
            state,
            read.attempts,
            "apply",
            state === "degraded" && !isOwned(read.value, ownership)
              ? "Resource ownership no longer matches this target."
              : undefined,
          ),
          observedAt: new Date(this.now()).toISOString(),
        });
      } catch (error) {
        throw this.executionError(error, outcomes);
      }
    }
    const rolloutStatus: KubernetesRolloutStatus = outcomes.some((resource) =>
      ["degraded", "missing", "failed"].includes(resource.status),
    )
      ? "degraded"
      : outcomes.some((resource) => resource.status === "progressing")
        ? "progressing"
        : "healthy";
    return { resources: outcomes, rolloutStatus };
  }

  async rollback(
    client: KubernetesResourceClient,
    current: ExecutableManifestBundle,
    previous: ExecutableManifestBundle,
    ownership: DeploymentOwnership,
  ): Promise<KubernetesApplyResult> {
    const deadline = this.now() + this.policy.operationTimeoutMs;
    const applied = await this.applyBeforeDeadline(
      client,
      previous,
      ownership,
      deadline,
    );
    const previousKeys = new Set(previous.resources.map(resourceKey));
    const removed = current.resources.filter(
      (resource) => !previousKeys.has(resourceKey(resource)),
    );
    const outcomes = [...applied.resources];

    for (const resource of removed) {
      if (
        resource.identity.scope !== "namespace" ||
        resource.identity.kind === "Namespace"
      ) {
        throw new KubernetesExecutionError(
          "KUBERNETES_ROLLBACK_DELETE_FORBIDDEN",
          "Rollback cannot delete a cluster-scoped resource.",
          outcomes,
        );
      }
      const read = await this.attempt(
        () => client.read(resourceReference(resource)),
        deadline,
      );
      if (!read.value) {
        outcomes.push(
          operationResource(resource, "missing", read.attempts, "delete"),
        );
        continue;
      }
      if (!isOwned(read.value, ownership)) {
        throw new KubernetesExecutionError(
          "KUBERNETES_RESOURCE_OWNERSHIP_CONFLICT",
          `${resource.identity.kind}/${resource.identity.name} is not owned by this BuildSphere target.`,
          outcomes,
        );
      }
      try {
        const deleted = await this.attempt(
          () => client.delete(resourceReference(resource)),
          deadline,
        );
        outcomes.push(
          operationResource(resource, "deleted", deleted.attempts, "delete"),
        );
      } catch (error) {
        outcomes.push(
          operationResource(
            resource,
            "failed",
            error instanceof AttemptFailure ? error.attempts : 1,
            "delete",
          ),
        );
        throw this.executionError(error, outcomes);
      }
    }
    return { resources: outcomes, rolloutStatus: "progressing" };
  }

  private async applyBeforeDeadline(
    client: KubernetesResourceClient,
    bundle: ExecutableManifestBundle,
    ownership: DeploymentOwnership,
    deadline: number,
  ): Promise<KubernetesApplyResult> {
    const outcomes = bundle.resources.map((resource) =>
      operationResource(resource),
    );
    const existing = new Map<string, KubernetesObject | undefined>();

    for (const resource of bundle.resources) {
      const read = await this.attempt(
        () => client.read(resourceReference(resource)),
        deadline,
      );
      existing.set(resourceKey(resource), read.value);
      if (
        read.value &&
        resource.identity.kind !== "Namespace" &&
        !isOwned(read.value, ownership)
      ) {
        throw new KubernetesExecutionError(
          "KUBERNETES_RESOURCE_OWNERSHIP_CONFLICT",
          `${resource.identity.kind}/${resource.identity.name} is not owned by this BuildSphere target.`,
          outcomes,
        );
      }
    }

    for (const [index, resource] of bundle.resources.entries()) {
      if (
        resource.identity.kind === "Namespace" &&
        existing.get(resourceKey(resource))
      ) {
        outcomes[index] = operationResource(resource, "retained", 1);
        continue;
      }
      try {
        const applied = await this.attempt(
          () => client.apply(withOwnership(resource.manifest, ownership)),
          deadline,
        );
        outcomes[index] = operationResource(
          resource,
          "applied",
          applied.attempts,
        );
      } catch (error) {
        outcomes[index] = operationResource(
          resource,
          "failed",
          error instanceof AttemptFailure ? error.attempts : 1,
        );
        throw this.executionError(error, outcomes);
      }
    }
    return { resources: outcomes, rolloutStatus: "progressing" };
  }

  private async attempt<T>(
    operation: () => Promise<T>,
    deadline: number,
  ): Promise<AttemptResult<T>> {
    let attempts = 0;
    while (attempts < this.policy.maxAttempts) {
      attempts += 1;
      if (this.now() >= deadline) {
        throw new AttemptFailure(
          new KubernetesExecutionError(
            "KUBERNETES_OPERATION_TIMEOUT",
            "The Kubernetes operation exceeded its configured deadline.",
            [],
          ),
          attempts,
        );
      }
      try {
        return { value: await operation(), attempts };
      } catch (error) {
        if (
          !(error instanceof KubernetesRequestError) ||
          !error.transient ||
          attempts >= this.policy.maxAttempts
        ) {
          throw new AttemptFailure(error, attempts);
        }
        await this.sleep(100 * 2 ** (attempts - 1));
      }
    }
    throw new AttemptFailure(
      new Error("The Kubernetes retry budget was exhausted."),
      attempts,
    );
  }

  private executionError(
    error: unknown,
    resources: KubernetesOperationResource[],
  ): KubernetesExecutionError {
    const cause = error instanceof AttemptFailure ? error.cause : error;
    if (cause instanceof KubernetesExecutionError) {
      return new KubernetesExecutionError(cause.code, cause.message, resources);
    }
    if (cause instanceof KubernetesRequestError) {
      return new KubernetesExecutionError(cause.code, cause.message, resources);
    }
    return new KubernetesExecutionError(
      "KUBERNETES_REQUEST_FAILED",
      "The Kubernetes API request failed.",
      resources,
    );
  }
}

class AttemptFailure extends Error {
  constructor(
    public readonly cause: unknown,
    public readonly attempts: number,
  ) {
    super("A Kubernetes request attempt failed.");
  }
}
