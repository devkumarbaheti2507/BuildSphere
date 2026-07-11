import { createHash } from "node:crypto";
import { loadAllYaml, type KubernetesObject } from "@kubernetes/client-node";
import type {
  DeploymentTarget,
  GeneratedFile,
  KubernetesDeploymentPlan,
  KubernetesDeploymentPlanResource,
  KubernetesOperationResource,
} from "@buildsphere/shared-types";
import { executableKubernetesKinds } from "./execution-policy.js";
import { buildDeploymentPlan, DeploymentPlanError } from "./planner.js";
import { selectKubernetesManifests } from "./validator.js";

type ExecutableManifestErrorCode =
  | "KUBERNETES_CREDENTIAL_REQUIRED"
  | "KUBERNETES_ENVIRONMENT_NOT_ALLOWED"
  | "KUBERNETES_KIND_NOT_ALLOWED"
  | "KUBERNETES_CLUSTER_SCOPE_FORBIDDEN"
  | "KUBERNETES_NAMESPACE_MISMATCH"
  | "KUBERNETES_SECRET_FORBIDDEN"
  | "KUBERNETES_METADATA_FORBIDDEN";

export class ExecutableManifestError extends Error {
  constructor(
    public readonly code: ExecutableManifestErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export interface ExecutableResource {
  identity: KubernetesDeploymentPlanResource;
  manifest: KubernetesObject;
}

export interface ExecutableManifestBundle {
  files: Array<Pick<GeneratedFile, "path" | "content">>;
  digest: string;
  plan: KubernetesDeploymentPlan;
  resources: ExecutableResource[];
  operationResources: KubernetesOperationResource[];
}

const executableKinds = new Set<string>(executableKubernetesKinds);
const forbiddenMetadata = [
  "creationTimestamp",
  "deletionGracePeriodSeconds",
  "deletionTimestamp",
  "finalizers",
  "generateName",
  "generation",
  "managedFields",
  "ownerReferences",
  "resourceVersion",
  "selfLink",
  "uid",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizedFiles = (
  files: Pick<GeneratedFile, "path" | "content">[],
): Array<Pick<GeneratedFile, "path" | "content">> =>
  selectKubernetesManifests(files)
    .map((file) => ({
      path: file.path.replaceAll("\\", "/"),
      content: file.content,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

export const deploymentManifestDigest = (
  files: Pick<GeneratedFile, "path" | "content">[],
): string =>
  createHash("sha256")
    .update(JSON.stringify(normalizedFiles(files)))
    .digest("hex");

export const buildExecutableManifestBundle = (
  target: DeploymentTarget,
  files: Pick<GeneratedFile, "path" | "content">[],
  allowedEnvironment: boolean,
): ExecutableManifestBundle => {
  if (target.config.connectionStatus !== "connected") {
    throw new ExecutableManifestError(
      "KUBERNETES_CREDENTIAL_REQUIRED",
      "Store an approved Kubernetes credential before execution.",
      { targetId: target.id },
    );
  }
  const connection = target.config.connection;
  if (!allowedEnvironment) {
    throw new ExecutableManifestError(
      "KUBERNETES_ENVIRONMENT_NOT_ALLOWED",
      "This target environment is not enabled for Kubernetes execution.",
      { environment: target.environment },
    );
  }

  let plan: KubernetesDeploymentPlan;
  try {
    plan = buildDeploymentPlan(target, files);
  } catch (error) {
    if (error instanceof DeploymentPlanError) throw error;
    throw error;
  }
  const selected = normalizedFiles(files);
  const documents = new Map<string, KubernetesObject>();
  for (const file of selected) {
    for (const [documentIndex, value] of loadAllYaml(file.content).entries()) {
      if (isRecord(value)) {
        documents.set(`${file.path}:${documentIndex}`, structuredClone(value));
      }
    }
  }

  const resources = plan.resources.map((identity): ExecutableResource => {
    if (identity.kind === "Secret") {
      throw new ExecutableManifestError(
        "KUBERNETES_SECRET_FORBIDDEN",
        `${identity.sourcePath}: Kubernetes Secret resources are not executable in Phase 9.`,
        { kind: identity.kind, name: identity.name },
      );
    }
    if (!executableKinds.has(identity.kind)) {
      throw new ExecutableManifestError(
        "KUBERNETES_KIND_NOT_ALLOWED",
        `${identity.sourcePath}: ${identity.kind} is outside the Phase 9 execution allowlist.`,
        { kind: identity.kind, name: identity.name },
      );
    }
    if (identity.scope === "cluster" && identity.kind !== "Namespace") {
      throw new ExecutableManifestError(
        "KUBERNETES_CLUSTER_SCOPE_FORBIDDEN",
        `${identity.sourcePath}: cluster-scoped ${identity.kind} is not executable.`,
        { kind: identity.kind, name: identity.name },
      );
    }
    if (
      (identity.kind === "Namespace" &&
        identity.name !== connection.namespace) ||
      (identity.scope === "namespace" &&
        identity.namespace !== connection.namespace)
    ) {
      throw new ExecutableManifestError(
        "KUBERNETES_NAMESPACE_MISMATCH",
        `${identity.sourcePath}: every resource must use the target namespace.`,
        {
          kind: identity.kind,
          name: identity.name,
          namespace: identity.namespace,
          targetNamespace: connection.namespace,
        },
      );
    }

    const manifest = documents.get(
      `${identity.sourcePath.replaceAll("\\", "/")}:${identity.documentIndex}`,
    );
    if (!manifest || !isRecord(manifest.metadata)) {
      throw new ExecutableManifestError(
        "KUBERNETES_METADATA_FORBIDDEN",
        `${identity.sourcePath}: resource metadata is invalid for execution.`,
      );
    }
    if ("status" in manifest) {
      throw new ExecutableManifestError(
        "KUBERNETES_METADATA_FORBIDDEN",
        `${identity.sourcePath}: resource status must not be supplied for execution.`,
      );
    }
    const blocked = forbiddenMetadata.find((key) => key in manifest.metadata!);
    if (blocked) {
      throw new ExecutableManifestError(
        "KUBERNETES_METADATA_FORBIDDEN",
        `${identity.sourcePath}: metadata.${blocked} is not accepted for execution.`,
        { field: `metadata.${blocked}` },
      );
    }
    if (identity.scope === "namespace") {
      manifest.metadata.namespace = connection.namespace;
    }
    return { identity, manifest };
  });

  return {
    files: selected,
    digest: deploymentManifestDigest(selected),
    plan,
    resources,
    operationResources: resources.map(({ identity }) => ({
      order: identity.order,
      apiVersion: identity.apiVersion,
      kind: identity.kind,
      name: identity.name,
      namespace: identity.namespace,
      scope: identity.scope,
      action: "apply",
      status: "pending",
      attempts: 0,
    })),
  };
};
