import { KubeConfig, loadYaml, type User } from "@kubernetes/client-node";
import type {
  KubernetesConnectionInspection,
  KubernetesConnectionSummary,
  KubernetesCredentialMechanism,
} from "@buildsphere/shared-types";

type KubeconfigErrorCode =
  | "KUBECONFIG_PARSE_ERROR"
  | "KUBECONFIG_FILE_REFERENCE_FORBIDDEN"
  | "KUBECONFIG_CURRENT_CONTEXT_REQUIRED"
  | "KUBECONFIG_CONTEXT_INVALID"
  | "KUBECONFIG_CLUSTER_INVALID";

export class KubeconfigInspectionError extends Error {
  constructor(
    public readonly code: KubeconfigErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const rejectLocalFileReferences = (source: string): void => {
  let raw: unknown;
  try {
    raw = loadYaml<unknown>(source);
  } catch {
    throw new KubeconfigInspectionError(
      "KUBECONFIG_PARSE_ERROR",
      "The kubeconfig could not be parsed.",
    );
  }
  if (!isRecord(raw) || raw.kind !== "Config") {
    throw new KubeconfigInspectionError(
      "KUBECONFIG_PARSE_ERROR",
      "The kubeconfig must contain a Kubernetes Config object.",
    );
  }

  for (const entry of records(raw.users)) {
    const user = isRecord(entry.user) ? entry.user : {};
    if (
      ["token-file", "client-certificate", "client-key"].some((key) =>
        hasOwn(user, key),
      )
    ) {
      throw new KubeconfigInspectionError(
        "KUBECONFIG_FILE_REFERENCE_FORBIDDEN",
        "Kubeconfig references to local credential files are not accepted.",
      );
    }
  }
  for (const entry of records(raw.clusters)) {
    const cluster = isRecord(entry.cluster) ? entry.cluster : {};
    if (hasOwn(cluster, "certificate-authority")) {
      throw new KubeconfigInspectionError(
        "KUBECONFIG_FILE_REFERENCE_FORBIDDEN",
        "Kubeconfig references to local certificate files are not accepted.",
      );
    }
  }
};

const safeName = (value: string, label: string): string => {
  const normalized = value.trim();
  const hasControlCharacter = [...normalized].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (!normalized || normalized.length > 253 || hasControlCharacter) {
    throw new KubeconfigInspectionError(
      "KUBECONFIG_CONTEXT_INVALID",
      `The kubeconfig ${label} is invalid.`,
    );
  }
  return normalized;
};

const safeNamespace = (value: string): string => {
  const namespace = safeName(value, "namespace");
  if (
    namespace.length > 63 ||
    !/^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/.test(namespace)
  ) {
    throw new KubeconfigInspectionError(
      "KUBECONFIG_CONTEXT_INVALID",
      "The kubeconfig namespace must be a valid DNS label.",
    );
  }
  return namespace;
};

const credentialMechanism = (
  user: User | null,
): KubernetesCredentialMechanism => {
  if (!user) return "none";
  if (user.token) return "token";
  if (user.certData || user.keyData) return "client-certificate";
  if (user.exec) return "exec";
  if (user.authProvider) return "auth-provider";
  if (user.username || user.password) return "basic";
  return "none";
};

const assertUniqueNames = (
  values: Array<{ name: string }>,
  label: string,
): void => {
  const names = new Set<string>();
  for (const value of values) {
    if (names.has(value.name)) {
      throw new KubeconfigInspectionError(
        "KUBECONFIG_CONTEXT_INVALID",
        `The kubeconfig contains duplicate ${label} names.`,
      );
    }
    names.add(value.name);
  }
};

export const inspectKubeconfig = (
  source: string,
): KubernetesConnectionInspection => {
  rejectLocalFileReferences(source);

  const config = new KubeConfig();
  try {
    config.loadFromString(source);
  } catch {
    throw new KubeconfigInspectionError(
      "KUBECONFIG_PARSE_ERROR",
      "The kubeconfig could not be parsed.",
    );
  }

  assertUniqueNames(config.contexts, "context");
  assertUniqueNames(config.clusters, "cluster");
  assertUniqueNames(config.users, "user");

  const currentContext = config.getCurrentContext()?.trim();
  if (!currentContext) {
    throw new KubeconfigInspectionError(
      "KUBECONFIG_CURRENT_CONTEXT_REQUIRED",
      "The kubeconfig must select a current context.",
    );
  }
  const context = config.getContextObject(currentContext);
  if (!context) {
    throw new KubeconfigInspectionError(
      "KUBECONFIG_CONTEXT_INVALID",
      "The selected kubeconfig context was not found.",
    );
  }
  const cluster = config.getCurrentCluster();
  if (!cluster) {
    throw new KubeconfigInspectionError(
      "KUBECONFIG_CLUSTER_INVALID",
      "The selected kubeconfig cluster was not found.",
    );
  }

  let server: URL;
  try {
    server = new URL(cluster.server);
  } catch {
    throw new KubeconfigInspectionError(
      "KUBECONFIG_CLUSTER_INVALID",
      "The selected cluster server URL is invalid.",
    );
  }
  if (
    !["http:", "https:"].includes(server.protocol) ||
    !server.host ||
    server.username ||
    server.password
  ) {
    throw new KubeconfigInspectionError(
      "KUBECONFIG_CLUSTER_INVALID",
      "The selected cluster must use an HTTP(S) server URL without embedded credentials.",
    );
  }

  const connection: KubernetesConnectionSummary = {
    context: safeName(currentContext, "context name"),
    cluster: safeName(cluster.name, "cluster name"),
    serverHost: server.host,
    namespace: safeNamespace(context.namespace || "default"),
    credentialMechanism: credentialMechanism(config.getCurrentUser()),
    tlsVerification: cluster.skipTLSVerify ? "disabled" : "enabled",
    contextCount: config.contexts.length,
  };
  const warnings: string[] = [];
  if (server.protocol !== "https:") {
    warnings.push("The selected API server uses unencrypted HTTP.");
  }
  if (cluster.skipTLSVerify) {
    warnings.push("TLS certificate verification is disabled for this cluster.");
  }
  if (connection.credentialMechanism === "none") {
    warnings.push("The selected context has no user credential mechanism.");
  }
  if (["exec", "auth-provider"].includes(connection.credentialMechanism)) {
    warnings.push(
      "Dynamic credentials are recognized but are not retained for execution.",
    );
  }

  return {
    valid: true,
    connection,
    warnings,
    clusterRequestMade: false,
  };
};
