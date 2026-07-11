import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import type { AddressInfo } from "node:net";
import { KubeConfig } from "@kubernetes/client-node";
import type {
  DeploymentTarget,
  GeneratedArtifact,
  GeneratedFile,
  KubernetesDeploymentApproval,
  KubernetesDeploymentOperation,
} from "@buildsphere/shared-types";
import { signToken } from "@buildsphere/service-core";
import { createDeploymentApp } from "../backend/deployment-service/src/app.js";
import { InMemoryProjectArtifactProvider } from "../backend/deployment-service/src/artifact-provider.js";
import type { KubernetesExecutionConfiguration } from "../backend/deployment-service/src/execution-policy.js";
import { inspectKubeconfig } from "../backend/deployment-service/src/kubeconfig.js";
import { OfficialKubernetesResourceClientFactory } from "../backend/deployment-service/src/kubernetes-client.js";
import { InMemoryDeploymentOperationRepository } from "../backend/deployment-service/src/operation-repository.js";
import { InMemoryDeploymentRepository } from "../backend/deployment-service/src/repository.js";

const projectId = "7bbadad4-c288-4d95-8663-db31e2226f86";
const ownerId = "8692b2a7-f584-4a7f-9820-0f6dd7764e73";
const namespace = "buildsphere-phase9-verification";
const accessSecret = "phase9-kind-verification-access-secret";

const manifest = (path: string, content: string): GeneratedFile => ({
  path,
  content,
  language: "yaml",
  explanation: "Disposable Phase 9 kind verification resource",
});

const releaseFiles = (includeReleaseMarker: boolean): GeneratedFile[] => [
  manifest(
    "kubernetes/namespace.yaml",
    `apiVersion: v1
kind: Namespace
metadata:
  name: ${namespace}
`,
  ),
  manifest(
    "kubernetes/deployment.yaml",
    `apiVersion: apps/v1
kind: Deployment
metadata:
  name: phase9-api
  namespace: ${namespace}
  labels:
    app: phase9-api
spec:
  replicas: 0
  selector:
    matchLabels:
      app: phase9-api
  template:
    metadata:
      labels:
        app: phase9-api
    spec:
      containers:
        - name: pause
          image: registry.k8s.io/pause:3.10
          readinessProbe:
            exec:
              command: ["true"]
          livenessProbe:
            exec:
              command: ["true"]
          resources:
            requests:
              cpu: 10m
              memory: 8Mi
            limits:
              cpu: 20m
              memory: 16Mi
`,
  ),
  manifest(
    "kubernetes/service.yaml",
    `apiVersion: v1
kind: Service
metadata:
  name: phase9-api
  namespace: ${namespace}
spec:
  selector:
    app: phase9-api
  ports:
    - port: 80
      targetPort: 8080
`,
  ),
  ...(includeReleaseMarker
    ? [
        manifest(
          "kubernetes/configmap.yaml",
          `apiVersion: v1
kind: ConfigMap
metadata:
  name: release-two-marker
  namespace: ${namespace}
data:
  release: second
`,
        ),
      ]
    : []),
];

const artifact = (
  id: string,
  includeReleaseMarker: boolean,
): GeneratedArtifact => ({
  id,
  projectId,
  artifactType: "bundle",
  files: releaseFiles(includeReleaseMarker),
  checksum: id.replaceAll("-", ""),
  createdAt: new Date().toISOString(),
});

const main = async (): Promise<void> => {
  const kubeconfigPath =
    process.env.KUBECONFIG_PATH ?? "/tmp/buildsphere-phase9-kubeconfig";
  const sourceKubeconfig = await fs.readFile(kubeconfigPath, "utf8");
  const namespacedConfig = new KubeConfig();
  namespacedConfig.loadFromString(sourceKubeconfig);
  const currentContext = namespacedConfig.getCurrentContext();
  namespacedConfig.loadFromOptions({
    clusters: namespacedConfig.clusters,
    users: namespacedConfig.users,
    contexts: namespacedConfig.contexts.map((context) =>
      context.name === currentContext ? { ...context, namespace } : context,
    ),
    currentContext,
  });
  const kubeconfig = namespacedConfig.exportConfig();
  const inspection = inspectKubeconfig(kubeconfig);
  const firstArtifact = artifact("c65eb4cd-97d2-4d1b-a035-b7c5b660385f", false);
  const secondArtifact = artifact("6ff592c0-d026-4798-a523-88e5ff65c491", true);
  const configuration: KubernetesExecutionConfiguration = {
    enabled: true,
    encryptionKey: Buffer.alloc(32, 17).toString("base64"),
    policy: {
      allowedServerHosts: new Set([inspection.connection.serverHost]),
      allowedEnvironments: new Set(["development"]),
      approvalTtlSeconds: 300,
      requestTimeoutMs: 10_000,
      operationTimeoutMs: 60_000,
      maxAttempts: 3,
    },
  };
  const clients = new OfficialKubernetesResourceClientFactory(10_000);
  let clock = Date.now();
  const server = createDeploymentApp(
    new InMemoryDeploymentRepository(),
    accessSecret,
    undefined,
    {
      operationRepository: new InMemoryDeploymentOperationRepository(),
      artifactProvider: new InMemoryProjectArtifactProvider([
        firstArtifact,
        secondArtifact,
      ]),
      kubernetesClients: clients,
      executionConfiguration: configuration,
      now: () => new Date((clock += 1)),
    },
  ).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const token = signToken(
    { userId: ownerId, email: "phase9-kind@example.com", role: "user" },
    accessSecret,
    "access",
    "15m",
  );
  const request = async <T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = (await response.json()) as {
      data?: T;
      error?: { code: string; message: string };
    };
    if (!response.ok || payload.data === undefined) {
      throw new Error(
        `${method} ${path} failed: ${payload.error?.code ?? response.status} ${payload.error?.message ?? ""}`,
      );
    }
    return payload.data;
  };

  try {
    const target = await request<DeploymentTarget>(
      "/deployments/targets",
      "POST",
      {
        projectId,
        name: "Disposable kind cluster",
        environment: "development",
        kubeconfig,
      },
    );
    const connected = await request<DeploymentTarget>(
      `/deployments/targets/${target.id}/credential`,
      "PUT",
      { kubeconfig, confirmed: true },
    );
    assert.equal(connected.config.connectionStatus, "connected");

    const deploy = async (artifactId: string) => {
      const approval = await request<KubernetesDeploymentApproval>(
        "/deployments/approvals",
        "POST",
        { targetId: target.id, artifactId, action: "apply", confirmed: true },
      );
      return request<KubernetesDeploymentOperation>(
        "/deployments/operations",
        "POST",
        { approvalId: approval.id, idempotencyKey: crypto.randomUUID() },
      );
    };

    const first = await deploy(firstArtifact.id);
    const second = await deploy(secondArtifact.id);
    assert.equal(first.status, "succeeded");
    assert.equal(second.status, "succeeded");
    assert.equal(second.rollbackAvailable, true);

    let observed = second;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      observed = await request<KubernetesDeploymentOperation>(
        `/deployments/operations/${second.id}/refresh`,
        "POST",
        {},
      );
      if (observed.rolloutStatus === "healthy") break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.equal(observed.rolloutStatus, "healthy");

    const rollbackApproval = await request<KubernetesDeploymentApproval>(
      `/deployments/operations/${second.id}/rollback-approval`,
      "POST",
      { confirmed: true },
    );
    const rollback = await request<KubernetesDeploymentOperation>(
      `/deployments/operations/${second.id}/rollback`,
      "POST",
      {
        approvalId: rollbackApproval.id,
        idempotencyKey: crypto.randomUUID(),
      },
    );
    assert.equal(rollback.status, "rolled_back");
    assert.equal(rollback.restoredOperationId, first.id);
    assert.equal(
      rollback.resources.some(
        (resource) =>
          resource.kind === "ConfigMap" && resource.status === "deleted",
      ),
      true,
    );

    const cluster = clients.create(kubeconfig);
    const deployed = await cluster.read({
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: { name: "phase9-api", namespace },
    });
    assert.equal(
      deployed?.metadata?.labels?.["buildsphere.dev/target-id"],
      target.id,
    );
    let releaseMarker = await cluster.read({
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: { name: "release-two-marker", namespace },
    });
    for (let attempt = 0; releaseMarker && attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      releaseMarker = await cluster.read({
        apiVersion: "v1",
        kind: "ConfigMap",
        metadata: { name: "release-two-marker", namespace },
      });
    }
    assert.equal(releaseMarker, undefined);

    const history = await request<KubernetesDeploymentOperation[]>(
      `/projects/${projectId}/deployment-operations`,
    );
    assert.equal(history.length, 3);
    const restored = history.find((operation) => operation.id === first.id);
    assert.equal(restored?.rollbackAvailable, false);
    assert.equal(
      JSON.stringify({ connected, first, second, observed, rollback }).includes(
        "client-certificate-data",
      ),
      false,
    );
    const revoked = await request<DeploymentTarget>(
      `/deployments/targets/${target.id}/credential`,
      "DELETE",
    );
    assert.equal(revoked.config.connectionStatus, "inspected");

    console.log(
      JSON.stringify(
        {
          status: "passed",
          kubernetesServer: inspection.connection.serverHost,
          credentialMechanism: inspection.connection.credentialMechanism,
          firstReleaseResources: first.resources.length,
          secondReleaseResources: second.resources.length,
          rolloutStatus: observed.rolloutStatus,
          rollbackStatus: rollback.status,
          prunedResources: rollback.resources.filter(
            (resource) => resource.status === "deleted",
          ).length,
          ownershipVerified:
            deployed?.metadata?.labels?.["buildsphere.dev/target-id"] ===
            target.id,
          credentialsRevoked: revoked.config.connectionStatus === "inspected",
        },
        null,
        2,
      ),
    );
  } finally {
    server.close();
  }
};

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
