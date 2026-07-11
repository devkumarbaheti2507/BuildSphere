import { loadAllYaml } from "@kubernetes/client-node";
import type {
  DeploymentTarget,
  GeneratedFile,
  KubernetesDeploymentPlan,
  KubernetesDeploymentPlanResource,
} from "@buildsphere/shared-types";
import {
  selectKubernetesManifests,
  validateKubernetesManifests,
} from "./validator.js";

type DeploymentPlanErrorCode =
  | "KUBERNETES_CONNECTION_REQUIRED"
  | "MANIFEST_VALIDATION_FAILED"
  | "MANIFEST_PARSE_ERROR"
  | "MANIFEST_RESOURCE_INVALID"
  | "MANIFEST_SECRET_DATA_FORBIDDEN"
  | "MANIFEST_RESOURCE_DUPLICATE";

export class DeploymentPlanError extends Error {
  constructor(
    public readonly code: DeploymentPlanErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requiredString = (
  value: unknown,
  sourcePath: string,
  field: string,
): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new DeploymentPlanError(
      "MANIFEST_RESOURCE_INVALID",
      `${sourcePath}: ${field} is required for deployment planning.`,
      { sourcePath, field },
    );
  }
  return value.trim();
};

const clusterScopedKinds = new Set([
  "APIService",
  "ClusterRole",
  "ClusterRoleBinding",
  "CustomResourceDefinition",
  "MutatingWebhookConfiguration",
  "Namespace",
  "Node",
  "PersistentVolume",
  "StorageClass",
  "ValidatingWebhookConfiguration",
]);

const priorityFor = (kind: string): number => {
  if (kind === "Namespace") return 0;
  if (kind === "CustomResourceDefinition") return 10;
  if (["ServiceAccount", "ConfigMap", "Secret"].includes(kind)) return 20;
  if (
    ["Role", "RoleBinding", "ClusterRole", "ClusterRoleBinding"].includes(kind)
  )
    return 25;
  if (kind === "Service") return 30;
  if (
    ["Deployment", "StatefulSet", "DaemonSet", "Job", "CronJob"].includes(kind)
  )
    return 40;
  if (kind === "Ingress") return 50;
  return 35;
};

const hasPopulatedData = (value: unknown): boolean =>
  value !== undefined &&
  value !== null &&
  (!isRecord(value) || Object.keys(value).length > 0);

export const buildDeploymentPlan = (
  target: DeploymentTarget,
  files: Pick<GeneratedFile, "path" | "content">[],
): KubernetesDeploymentPlan => {
  if (target.config.connectionStatus === "draft") {
    throw new DeploymentPlanError(
      "KUBERNETES_CONNECTION_REQUIRED",
      "Inspect a kubeconfig for this target before building a deployment plan.",
      { targetId: target.id },
    );
  }

  const manifests = selectKubernetesManifests(files);
  const validation = validateKubernetesManifests(manifests);
  if (!validation.valid) {
    throw new DeploymentPlanError(
      "MANIFEST_VALIDATION_FAILED",
      "The Kubernetes manifests must pass structural validation before planning.",
      { errors: validation.errors, warnings: validation.warnings },
    );
  }

  const planned: Array<
    KubernetesDeploymentPlanResource & { priority: number }
  > = [];
  const identities = new Set<string>();
  for (const file of manifests) {
    let documents: unknown[];
    try {
      documents = loadAllYaml(file.content);
    } catch {
      throw new DeploymentPlanError(
        "MANIFEST_PARSE_ERROR",
        `${file.path}: Kubernetes YAML could not be parsed.`,
        { sourcePath: file.path },
      );
    }
    for (const [documentIndex, document] of documents.entries()) {
      if (!isRecord(document)) {
        throw new DeploymentPlanError(
          "MANIFEST_RESOURCE_INVALID",
          `${file.path}: every YAML document must contain a Kubernetes resource.`,
          { sourcePath: file.path, documentIndex },
        );
      }
      const metadata = isRecord(document.metadata) ? document.metadata : {};
      const apiVersion = requiredString(
        document.apiVersion,
        file.path,
        "apiVersion",
      );
      const kind = requiredString(document.kind, file.path, "kind");
      const name = requiredString(metadata.name, file.path, "metadata.name");
      if (
        kind === "Secret" &&
        (hasPopulatedData(document.data) ||
          hasPopulatedData(document.stringData))
      ) {
        throw new DeploymentPlanError(
          "MANIFEST_SECRET_DATA_FORBIDDEN",
          `${file.path}: populated Kubernetes Secret data is not accepted for planning.`,
          { sourcePath: file.path, documentIndex },
        );
      }

      const scope = clusterScopedKinds.has(kind) ? "cluster" : "namespace";
      const namespace =
        scope === "namespace"
          ? typeof metadata.namespace === "string" && metadata.namespace.trim()
            ? metadata.namespace.trim()
            : target.config.connection.namespace
          : undefined;
      const identity = [apiVersion, kind, namespace || "", name].join("|");
      if (identities.has(identity)) {
        throw new DeploymentPlanError(
          "MANIFEST_RESOURCE_DUPLICATE",
          `${file.path}: the deployment plan contains a duplicate resource.`,
          { apiVersion, kind, name, namespace },
        );
      }
      identities.add(identity);
      planned.push({
        order: 0,
        sourcePath: file.path,
        documentIndex,
        apiVersion,
        kind,
        name,
        namespace,
        scope,
        action: "apply",
        priority: priorityFor(kind),
      });
    }
  }

  planned.sort(
    (left, right) =>
      left.priority - right.priority ||
      left.sourcePath.localeCompare(right.sourcePath) ||
      left.documentIndex - right.documentIndex,
  );
  const resources = planned.map(
    ({ priority: _priority, ...resource }, index) => ({
      ...resource,
      order: index + 1,
    }),
  );

  const warnings = [...validation.warnings];
  if (target.config.connection.tlsVerification === "disabled") {
    warnings.push(
      "The selected target has TLS certificate verification disabled.",
    );
  }
  warnings.push(
    "Offline preflight does not verify reachability, authorization, admission policies, or server-side schema.",
  );

  return {
    targetId: target.id,
    projectId: target.projectId,
    environment: target.environment,
    mode: "offline-preflight",
    executable: false,
    clusterRequestMade: false,
    connection: target.config.connection,
    resources,
    warnings,
    createdAt: new Date().toISOString(),
  };
};
