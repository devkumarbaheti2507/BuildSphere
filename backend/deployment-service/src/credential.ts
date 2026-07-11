import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { KubeConfig } from "@kubernetes/client-node";
import type {
  KubernetesConnectionInspection,
  KubernetesConnectionSummary,
} from "@buildsphere/shared-types";
import type { KubernetesExecutionPolicy } from "./execution-policy.js";
import { inspectKubeconfig } from "./kubeconfig.js";

type ExecutionCredentialErrorCode =
  | "KUBERNETES_SERVER_NOT_ALLOWED"
  | "KUBERNETES_TLS_REQUIRED"
  | "KUBERNETES_PROXY_FORBIDDEN"
  | "KUBERNETES_DYNAMIC_CREDENTIAL_FORBIDDEN"
  | "KUBERNETES_IMPERSONATION_FORBIDDEN"
  | "KUBERNETES_CREDENTIAL_INCOMPLETE"
  | "KUBERNETES_CREDENTIAL_INVALID";

export class ExecutionCredentialError extends Error {
  constructor(
    public readonly code: ExecutionCredentialErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface PreparedKubernetesCredential {
  kubeconfig: string;
  fingerprint: string;
  connection: KubernetesConnectionSummary;
  inspection: KubernetesConnectionInspection;
}

const serverHostAndPort = (server: URL): string => {
  const hostname = server.hostname.toLowerCase();
  const formattedHostname =
    hostname.includes(":") && !hostname.startsWith("[")
      ? `[${hostname}]`
      : hostname;
  return `${formattedHostname}:${server.port || "443"}`;
};

const associatedData = (ownerId: string, targetId: string): Buffer =>
  Buffer.from(
    `buildsphere:kubernetes-credential:v1:${ownerId}:${targetId}`,
    "utf8",
  );

export class KubernetesCredentialCipher {
  private readonly key: Buffer;

  constructor(encodedKey: string) {
    this.key = Buffer.from(encodedKey, "base64");
    if (this.key.length !== 32) {
      throw new Error(
        "KUBERNETES_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
      );
    }
  }

  encrypt(value: string, ownerId: string, targetId: string): string {
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv(
      "aes-256-gcm",
      this.key,
      initializationVector,
    );
    cipher.setAAD(associatedData(ownerId, targetId));
    const ciphertext = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return [
      "v1",
      initializationVector.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  }

  decrypt(value: string, ownerId: string, targetId: string): string {
    const [version, encodedIv, encodedTag, encodedCiphertext] =
      value.split(".");
    if (version !== "v1" || !encodedIv || !encodedTag || !encodedCiphertext) {
      throw new ExecutionCredentialError(
        "KUBERNETES_CREDENTIAL_INVALID",
        "The stored Kubernetes credential is invalid.",
      );
    }
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        Buffer.from(encodedIv, "base64url"),
      );
      decipher.setAAD(associatedData(ownerId, targetId));
      decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(encodedCiphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new ExecutionCredentialError(
        "KUBERNETES_CREDENTIAL_INVALID",
        "The stored Kubernetes credential could not be decrypted.",
      );
    }
  }
}

export const prepareKubeconfigForExecution = (
  source: string,
  policy: KubernetesExecutionPolicy,
): PreparedKubernetesCredential => {
  const inspection = inspectKubeconfig(source);
  const config = new KubeConfig();
  config.loadFromString(source);
  const context = config.getContextObject(config.getCurrentContext());
  const cluster = config.getCurrentCluster();
  const user = config.getCurrentUser();
  if (!context || !cluster || !user) {
    throw new ExecutionCredentialError(
      "KUBERNETES_CREDENTIAL_INCOMPLETE",
      "The selected context must contain an embedded user credential.",
    );
  }

  const server = new URL(cluster.server);
  if (
    server.protocol !== "https:" ||
    cluster.skipTLSVerify ||
    inspection.connection.tlsVerification !== "enabled"
  ) {
    throw new ExecutionCredentialError(
      "KUBERNETES_TLS_REQUIRED",
      "Kubernetes execution requires HTTPS with TLS verification enabled.",
    );
  }
  if (!policy.allowedServerHosts.has(serverHostAndPort(server))) {
    throw new ExecutionCredentialError(
      "KUBERNETES_SERVER_NOT_ALLOWED",
      "The selected Kubernetes API server is not in the execution allowlist.",
    );
  }
  if (cluster.proxyUrl) {
    throw new ExecutionCredentialError(
      "KUBERNETES_PROXY_FORBIDDEN",
      "Kubeconfig proxy URLs are not accepted for execution.",
    );
  }
  if (user.exec || user.authProvider) {
    throw new ExecutionCredentialError(
      "KUBERNETES_DYNAMIC_CREDENTIAL_FORBIDDEN",
      "Exec plugins and auth providers are not accepted for execution.",
    );
  }
  if (user.impersonateUser) {
    throw new ExecutionCredentialError(
      "KUBERNETES_IMPERSONATION_FORBIDDEN",
      "Kubernetes user impersonation is not accepted for execution.",
    );
  }

  const selectedUser = { name: user.name } as {
    name: string;
    token?: string;
    certData?: string;
    keyData?: string;
    username?: string;
    password?: string;
  };
  if (inspection.connection.credentialMechanism === "token" && user.token) {
    selectedUser.token = user.token;
  } else if (
    inspection.connection.credentialMechanism === "client-certificate" &&
    user.certData &&
    user.keyData
  ) {
    selectedUser.certData = user.certData;
    selectedUser.keyData = user.keyData;
  } else if (
    inspection.connection.credentialMechanism === "basic" &&
    user.username &&
    user.password
  ) {
    selectedUser.username = user.username;
    selectedUser.password = user.password;
  } else {
    throw new ExecutionCredentialError(
      "KUBERNETES_CREDENTIAL_INCOMPLETE",
      "Use an embedded token, complete client certificate, or complete basic credential for execution.",
    );
  }

  const minimized = new KubeConfig();
  minimized.loadFromOptions({
    clusters: [
      {
        name: cluster.name,
        server: cluster.server,
        caData: cluster.caData,
        tlsServerName: cluster.tlsServerName,
        skipTLSVerify: false,
      },
    ],
    contexts: [
      {
        name: context.name,
        cluster: cluster.name,
        user: user.name,
        namespace: inspection.connection.namespace,
      },
    ],
    users: [selectedUser],
    currentContext: context.name,
  });
  const kubeconfig = minimized.exportConfig();
  return {
    kubeconfig,
    fingerprint: createHash("sha256").update(kubeconfig).digest("hex"),
    connection: inspection.connection,
    inspection,
  };
};
