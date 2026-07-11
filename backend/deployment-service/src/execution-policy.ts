import type {
  DeploymentEnvironment,
  KubernetesExecutionCapabilities,
} from "@buildsphere/shared-types";

export const executableKubernetesKinds = [
  "Namespace",
  "ConfigMap",
  "ServiceAccount",
  "Role",
  "RoleBinding",
  "Service",
  "Deployment",
  "StatefulSet",
  "DaemonSet",
  "Job",
  "CronJob",
  "Ingress",
] as const;

export interface KubernetesExecutionPolicy {
  allowedServerHosts: ReadonlySet<string>;
  allowedEnvironments: ReadonlySet<DeploymentEnvironment>;
  approvalTtlSeconds: number;
  requestTimeoutMs: number;
  operationTimeoutMs: number;
  maxAttempts: number;
}

export interface KubernetesExecutionConfiguration {
  enabled: boolean;
  encryptionKey?: string;
  policy: KubernetesExecutionPolicy;
}

export const disabledKubernetesExecutionConfiguration =
  (): KubernetesExecutionConfiguration => ({
    enabled: false,
    policy: {
      allowedServerHosts: new Set(),
      allowedEnvironments: new Set(["development"]),
      approvalTtlSeconds: 300,
      requestTimeoutMs: 10_000,
      operationTimeoutMs: 60_000,
      maxAttempts: 3,
    },
  });

const environments = new Set<DeploymentEnvironment>([
  "development",
  "staging",
  "production",
]);

const integerSetting = (
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number => {
  const source = process.env[name]?.trim();
  const value = source ? Number(source) : fallback;
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
};

const parseHosts = (source: string | undefined): Set<string> => {
  const hosts = new Set<string>();
  for (const value of (source ?? "").split(",")) {
    const host = value.trim().toLowerCase();
    if (!host) continue;
    const match = /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+):(\d{1,5})$/i.exec(host);
    const port = Number(match?.[2]);
    if (!match || port < 1 || port > 65_535) {
      throw new Error(
        "KUBERNETES_ALLOWED_SERVER_HOSTS must contain exact host:port values",
      );
    }
    try {
      new URL(`https://${host}`);
    } catch {
      throw new Error(
        "KUBERNETES_ALLOWED_SERVER_HOSTS must contain exact host:port values",
      );
    }
    hosts.add(host);
  }
  return hosts;
};

const parseEnvironments = (source: string | undefined) => {
  const values = (source ?? "development")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const result = new Set<DeploymentEnvironment>();
  for (const value of values) {
    if (!environments.has(value as DeploymentEnvironment)) {
      throw new Error(
        "KUBERNETES_ALLOWED_ENVIRONMENTS contains an unsupported environment",
      );
    }
    result.add(value as DeploymentEnvironment);
  }
  if (!result.size) {
    throw new Error("KUBERNETES_ALLOWED_ENVIRONMENTS cannot be empty");
  }
  return result;
};

export const kubernetesExecutionConfigurationFromEnvironment =
  (): KubernetesExecutionConfiguration => {
    const enabled = process.env.KUBERNETES_EXECUTION_ENABLED === "true";
    const encryptionKey =
      process.env.KUBERNETES_CREDENTIAL_ENCRYPTION_KEY?.trim();
    const policy: KubernetesExecutionPolicy = {
      allowedServerHosts: parseHosts(
        process.env.KUBERNETES_ALLOWED_SERVER_HOSTS,
      ),
      allowedEnvironments: parseEnvironments(
        process.env.KUBERNETES_ALLOWED_ENVIRONMENTS,
      ),
      approvalTtlSeconds: integerSetting(
        "KUBERNETES_APPROVAL_TTL_SECONDS",
        300,
        60,
        900,
      ),
      requestTimeoutMs: integerSetting(
        "KUBERNETES_REQUEST_TIMEOUT_MS",
        10_000,
        1_000,
        30_000,
      ),
      operationTimeoutMs: integerSetting(
        "KUBERNETES_OPERATION_TIMEOUT_MS",
        60_000,
        5_000,
        300_000,
      ),
      maxAttempts: integerSetting("KUBERNETES_MAX_ATTEMPTS", 3, 1, 3),
    };
    if (enabled && (!encryptionKey || !policy.allowedServerHosts.size)) {
      throw new Error(
        "Kubernetes execution requires an encryption key and at least one allowed server host",
      );
    }
    return { enabled, encryptionKey, policy };
  };

export const executionCapabilities = (
  configuration: KubernetesExecutionConfiguration,
): KubernetesExecutionCapabilities => ({
  executionEnabled: configuration.enabled,
  allowedEnvironments: [...configuration.policy.allowedEnvironments],
  approvalTtlSeconds: configuration.policy.approvalTtlSeconds,
  requestTimeoutMs: configuration.policy.requestTimeoutMs,
  operationTimeoutMs: configuration.policy.operationTimeoutMs,
  maxAttempts: configuration.policy.maxAttempts,
  supportedKinds: [...executableKubernetesKinds],
});
