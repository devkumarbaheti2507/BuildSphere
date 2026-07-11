import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type {
  DeploymentTarget,
  GeneratedArtifact,
  KubernetesConnectionInspection,
  KubernetesDeploymentApproval,
  KubernetesDeploymentOperation,
  KubernetesDeploymentPlan,
} from "@buildsphere/shared-types";
import type { KubernetesObject } from "@kubernetes/client-node";
import { signToken } from "@buildsphere/service-core";
import { createDeploymentApp } from "./app.js";
import { InMemoryProjectArtifactProvider } from "./artifact-provider.js";
import type { KubernetesExecutionConfiguration } from "./execution-policy.js";
import type {
  KubernetesResourceClient,
  KubernetesResourceClientFactory,
} from "./kubernetes-client.js";
import { InMemoryDeploymentOperationRepository } from "./operation-repository.js";
import { InMemoryDeploymentRepository } from "./repository.js";
import { validateKubernetesManifests } from "./validator.js";

const connectedKubeconfig = `apiVersion: v1
kind: Config
clusters:
  - name: local-test
    cluster:
      server: https://127.0.0.1:6443
      certificate-authority-data: c2VjcmV0LWNhLWRhdGE=
contexts:
  - name: local-test-context
    context:
      cluster: local-test
      user: local-test-user
      namespace: buildsphere-test
current-context: local-test-context
users:
  - name: local-test-user
    user:
      token: phase-nine-secret-token
`;

const plannedManifests = [
  {
    path: "kubernetes/namespace.yaml",
    content:
      "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: buildsphere-test\n",
  },
  {
    path: "kubernetes/deployment.yaml",
    content:
      "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: api\n  labels:\n    app: api\nspec:\n  template:\n    spec:\n      containers: []\n      readinessProbe: {}\n      livenessProbe: {}\n      resources: {}\n",
  },
  {
    path: "kubernetes/service.yaml",
    content: "apiVersion: v1\nkind: Service\nmetadata:\n  name: api\n",
  },
  {
    path: "kubernetes/ingress.yaml",
    content:
      "apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: api\n",
  },
];

test("generated Kubernetes-shaped manifests pass structural validation", () => {
  const result = validateKubernetesManifests([
    {
      path: "kubernetes/namespace.yaml",
      content: "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: demo\n",
    },
    {
      path: "kubernetes/deployment.yaml",
      content:
        "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: demo\n  labels:\n    app: demo\nspec:\n  template:\n    spec:\n      containers: []\n      readinessProbe: {}\n      livenessProbe: {}\n      resources: {}\n",
    },
    {
      path: "kubernetes/service.yaml",
      content: "apiVersion: v1\nkind: Service\nmetadata:\n  name: demo\n",
    },
    {
      path: "kubernetes/ingress.yaml",
      content:
        "apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: demo\n",
    },
    {
      path: "helm/Chart.yaml",
      content:
        "apiVersion: v2\nname: demo\nversion: 0.1.0\nappVersion: latest\n",
    },
    {
      path: "helm/templates/deployment.yaml",
      content:
        'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: {{ include "demo.fullname" . }}\n',
    },
  ]);
  assert.equal(result.valid, true);
  assert.equal(
    result.errors.some((error) => error.includes("helm/")),
    false,
  );
});

test("Helm chart sources are not accepted as rendered Kubernetes manifests", () => {
  const result = validateKubernetesManifests([
    {
      path: "helm/Chart.yaml",
      content: "apiVersion: v2\nname: demo\nversion: 0.1.0\n",
    },
    {
      path: "helm/templates/service.yaml",
      content:
        'apiVersion: v1\nkind: Service\nmetadata:\n  name: {{ include "demo.fullname" . }}\n',
    },
  ]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("No Kubernetes YAML files were provided."));
});

test("deployment targets are authenticated and user scoped", async () => {
  const secret = "deployment-test-secret";
  const token = signToken(
    {
      userId: "6563dc65-43b0-4eb7-be7a-48858ff76290",
      email: "user@example.com",
      role: "user",
    },
    secret,
    "access",
    "15m",
  );
  const server = createDeploymentApp(
    new InMemoryDeploymentRepository(),
    secret,
  ).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal((await fetch(`${baseUrl}/deployments/targets`)).status, 401);
    const capabilities = await fetch(`${baseUrl}/deployments/capabilities`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(capabilities.status, 200);
    assert.equal(
      ((await capabilities.json()) as { data: { executionEnabled: boolean } })
        .data.executionEnabled,
      false,
    );
    const response = await fetch(`${baseUrl}/deployments/targets`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        projectId: "d0328785-a6c2-40d0-a26e-54cfd593c81e",
        name: "Local cluster",
        environment: "development",
        config: {},
      }),
    });
    assert.equal(response.status, 201);
    const target = (await response.json()) as { data: DeploymentTarget };
    assert.equal(target.data.config.connectionStatus, "draft");
    const credentialResponse = await fetch(
      `${baseUrl}/deployments/targets/${target.data.id}/credential`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          kubeconfig: connectedKubeconfig,
          confirmed: true,
        }),
      },
    );
    assert.equal(credentialResponse.status, 503);
    const planResponse = await fetch(`${baseUrl}/deployments/plans`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        targetId: target.data.id,
        manifests: plannedManifests,
      }),
    });
    assert.equal(planResponse.status, 409);
  } finally {
    server.close();
  }
});

test("kubeconfig inspection and planning redact credentials and remain owner scoped", async () => {
  const secret = "deployment-test-secret";
  const ownerId = "6563dc65-43b0-4eb7-be7a-48858ff76290";
  const token = signToken(
    { userId: ownerId, email: "user@example.com", role: "user" },
    secret,
    "access",
    "15m",
  );
  const otherToken = signToken(
    {
      userId: "dc9e7ac7-6ea4-4ea1-8a38-e3b34a9cf3a3",
      email: "other@example.com",
      role: "user",
    },
    secret,
    "access",
    "15m",
  );
  const repository = new InMemoryDeploymentRepository();
  const server = createDeploymentApp(repository, secret).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  try {
    const inspectionResponse = await fetch(
      `${baseUrl}/deployments/kubernetes/inspect`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ kubeconfig: connectedKubeconfig }),
      },
    );
    assert.equal(inspectionResponse.status, 200);
    const inspection = (await inspectionResponse.json()) as {
      data: KubernetesConnectionInspection;
    };
    assert.equal(inspection.data.connection.serverHost, "127.0.0.1:6443");
    assert.equal(inspection.data.connection.credentialMechanism, "token");
    assert.equal(inspection.data.clusterRequestMade, false);
    assert.equal(
      JSON.stringify(inspection).includes("phase-nine-secret-token"),
      false,
    );
    assert.equal(JSON.stringify(inspection).includes("c2VjcmV0"), false);

    const targetResponse = await fetch(`${baseUrl}/deployments/targets`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        projectId: "d0328785-a6c2-40d0-a26e-54cfd593c81e",
        name: "Inspected cluster",
        environment: "development",
        kubeconfig: connectedKubeconfig,
      }),
    });
    assert.equal(targetResponse.status, 201);
    const target = (await targetResponse.json()) as { data: DeploymentTarget };
    assert.equal(target.data.config.connectionStatus, "inspected");
    assert.equal(
      JSON.stringify(target).includes("phase-nine-secret-token"),
      false,
    );

    const planResponse = await fetch(`${baseUrl}/deployments/plans`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        targetId: target.data.id,
        manifests: plannedManifests,
      }),
    });
    assert.equal(planResponse.status, 200);
    const plan = (await planResponse.json()) as {
      data: KubernetesDeploymentPlan;
    };
    assert.equal(plan.data.executable, false);
    assert.equal(plan.data.clusterRequestMade, false);
    assert.deepEqual(
      plan.data.resources.map((resource) => resource.kind),
      ["Namespace", "Service", "Deployment", "Ingress"],
    );

    const otherPlanResponse = await fetch(`${baseUrl}/deployments/plans`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${otherToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        targetId: target.data.id,
        manifests: plannedManifests,
      }),
    });
    assert.equal(otherPlanResponse.status, 404);
  } finally {
    server.close();
  }
});

const executableArtifact = (
  id: string,
  projectId: string,
  extraFiles: Array<{ path: string; content: string }> = [],
): GeneratedArtifact => ({
  id,
  projectId,
  artifactType: "bundle",
  files: [...plannedManifests, ...extraFiles].map((file) => ({
    ...file,
    language: "yaml",
    explanation: "Kubernetes test manifest",
  })),
  checksum: id.replaceAll("-", ""),
  createdAt: "2026-07-11T12:00:00.000Z",
});

const objectKey = (resource: KubernetesObject): string =>
  [
    resource.apiVersion,
    resource.kind,
    resource.metadata?.namespace ?? "",
    resource.metadata?.name,
  ].join("|");

class AppTestKubernetesClient implements KubernetesResourceClient {
  readonly objects = new Map<string, KubernetesObject>();
  applyCalls = 0;
  deleteCalls = 0;

  async read(resource: KubernetesObject) {
    const value = this.objects.get(objectKey(resource));
    return value ? structuredClone(value) : undefined;
  }

  async apply(resource: KubernetesObject) {
    this.applyCalls += 1;
    const stored = structuredClone(resource) as KubernetesObject & {
      status?: Record<string, unknown>;
    };
    if (stored.kind === "Deployment") {
      stored.metadata = { ...stored.metadata, generation: 1 };
      stored.status = { observedGeneration: 1, availableReplicas: 1 };
    }
    this.objects.set(objectKey(stored), stored);
  }

  async delete(resource: KubernetesObject) {
    this.deleteCalls += 1;
    this.objects.delete(objectKey(resource));
  }
}

class AppTestKubernetesClients implements KubernetesResourceClientFactory {
  readonly client = new AppTestKubernetesClient();
  create() {
    return this.client;
  }
}

test("approved deployments integrate credential storage, idempotency, status, and rollback", async () => {
  const secret = "deployment-test-secret";
  const ownerId = "6563dc65-43b0-4eb7-be7a-48858ff76290";
  const projectId = "d0328785-a6c2-40d0-a26e-54cfd593c81e";
  const token = signToken(
    { userId: ownerId, email: "user@example.com", role: "user" },
    secret,
    "access",
    "15m",
  );
  const otherToken = signToken(
    {
      userId: "dc9e7ac7-6ea4-4ea1-8a38-e3b34a9cf3a3",
      email: "other@example.com",
      role: "user",
    },
    secret,
    "access",
    "15m",
  );
  const firstArtifact = executableArtifact(
    "3d5158c7-1683-4fab-bef9-81d8fc19d515",
    projectId,
  );
  const secondArtifact = executableArtifact(
    "3ac5c4fd-842e-4180-bbcc-2b4fe398c202",
    projectId,
    [
      {
        path: "kubernetes/configmap.yaml",
        content:
          "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: release-two\n  namespace: buildsphere-test\n",
      },
    ],
  );
  const configuration: KubernetesExecutionConfiguration = {
    enabled: true,
    encryptionKey: Buffer.alloc(32, 4).toString("base64"),
    policy: {
      allowedServerHosts: new Set(["127.0.0.1:6443"]),
      allowedEnvironments: new Set(["development"]),
      approvalTtlSeconds: 300,
      requestTimeoutMs: 1_000,
      operationTimeoutMs: 5_000,
      maxAttempts: 2,
    },
  };
  const clients = new AppTestKubernetesClients();
  let timestamp = Date.parse("2026-07-11T12:00:00.000Z");
  const server = createDeploymentApp(
    new InMemoryDeploymentRepository(),
    secret,
    undefined,
    {
      operationRepository: new InMemoryDeploymentOperationRepository(),
      artifactProvider: new InMemoryProjectArtifactProvider([
        firstArtifact,
        secondArtifact,
      ]),
      kubernetesClients: clients,
      executionConfiguration: configuration,
      now: () => new Date((timestamp += 1_000)),
    },
  ).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  const post = (path: string, body: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  try {
    const capabilities = await fetch(`${baseUrl}/deployments/capabilities`, {
      headers,
    });
    assert.equal(capabilities.status, 200);
    assert.equal(
      ((await capabilities.json()) as { data: { executionEnabled: boolean } })
        .data.executionEnabled,
      true,
    );

    const targetResponse = await post("/deployments/targets", {
      projectId,
      name: "Execution cluster",
      environment: "development",
      kubeconfig: connectedKubeconfig,
    });
    const target = (await targetResponse.json()) as { data: DeploymentTarget };
    const credentialResponse = await fetch(
      `${baseUrl}/deployments/targets/${target.data.id}/credential`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          kubeconfig: connectedKubeconfig,
          confirmed: true,
        }),
      },
    );
    assert.equal(credentialResponse.status, 200);
    const connected = (await credentialResponse.json()) as {
      data: DeploymentTarget;
    };
    assert.equal(connected.data.config.connectionStatus, "connected");
    assert.equal(
      JSON.stringify(connected).includes("phase-nine-secret-token"),
      false,
    );

    const staleApprovalResponse = await post("/deployments/approvals", {
      targetId: target.data.id,
      artifactId: firstArtifact.id,
      action: "apply",
      confirmed: true,
    });
    const staleApproval = (await staleApprovalResponse.json()) as {
      data: KubernetesDeploymentApproval;
    };
    const rotatedCredential = await fetch(
      `${baseUrl}/deployments/targets/${target.data.id}/credential`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          kubeconfig: connectedKubeconfig.replace(
            "phase-nine-secret-token",
            "rotated-phase-nine-secret-token",
          ),
          confirmed: true,
        }),
      },
    );
    assert.equal(rotatedCredential.status, 200);
    const staleExecution = await post("/deployments/operations", {
      approvalId: staleApproval.data.id,
      idempotencyKey: "a5545f17-c86f-4057-a45a-74e5aed83969",
    });
    assert.equal(staleExecution.status, 409);
    assert.equal(clients.client.applyCalls, 0);

    const approveFirst = await post("/deployments/approvals", {
      targetId: target.data.id,
      artifactId: firstArtifact.id,
      action: "apply",
      confirmed: true,
    });
    assert.equal(approveFirst.status, 201);
    const firstApproval = (await approveFirst.json()) as {
      data: KubernetesDeploymentApproval;
    };
    const firstKey = "146f557a-ee1a-46cb-9428-734245b672c2";
    const executeFirst = await post("/deployments/operations", {
      approvalId: firstApproval.data.id,
      idempotencyKey: firstKey,
    });
    assert.equal(executeFirst.status, 201);
    const firstOperation = (await executeFirst.json()) as {
      data: KubernetesDeploymentOperation;
    };
    assert.equal(firstOperation.data.status, "succeeded");
    const applyCalls = clients.client.applyCalls;

    const replay = await post("/deployments/operations", {
      approvalId: firstApproval.data.id,
      idempotencyKey: firstKey,
    });
    const replayed = (await replay.json()) as {
      data: KubernetesDeploymentOperation;
    };
    assert.equal(replayed.data.id, firstOperation.data.id);
    assert.equal(clients.client.applyCalls, applyCalls);

    const approveSecond = await post("/deployments/approvals", {
      targetId: target.data.id,
      artifactId: secondArtifact.id,
      action: "apply",
      confirmed: true,
    });
    const secondApproval = (await approveSecond.json()) as {
      data: KubernetesDeploymentApproval;
    };
    const executeSecond = await post("/deployments/operations", {
      approvalId: secondApproval.data.id,
      idempotencyKey: "bd44d190-c81f-4681-ae8f-d6bfef44a2ae",
    });
    const secondOperation = (await executeSecond.json()) as {
      data: KubernetesDeploymentOperation;
    };
    assert.equal(secondOperation.data.status, "succeeded");
    assert.equal(secondOperation.data.rollbackAvailable, true);

    const refresh = await post(
      `/deployments/operations/${secondOperation.data.id}/refresh`,
      {},
    );
    const refreshed = (await refresh.json()) as {
      data: KubernetesDeploymentOperation;
    };
    assert.equal(refreshed.data.rolloutStatus, "healthy");

    const approveRollback = await post(
      `/deployments/operations/${secondOperation.data.id}/rollback-approval`,
      { confirmed: true },
    );
    const rollbackApproval = (await approveRollback.json()) as {
      data: KubernetesDeploymentApproval;
    };
    const rollback = await post(
      `/deployments/operations/${secondOperation.data.id}/rollback`,
      {
        approvalId: rollbackApproval.data.id,
        idempotencyKey: "440b47dd-822c-4658-afec-757fc1bedf77",
      },
    );
    const rolledBack = (await rollback.json()) as {
      data: KubernetesDeploymentOperation;
    };
    assert.equal(rolledBack.data.status, "rolled_back");
    assert.equal(clients.client.deleteCalls, 1);
    assert.equal(
      rolledBack.data.resources.some(
        (resource) =>
          resource.kind === "ConfigMap" && resource.status === "deleted",
      ),
      true,
    );

    const history = await fetch(
      `${baseUrl}/projects/${projectId}/deployment-operations`,
      { headers },
    );
    assert.equal(history.status, 200);
    assert.equal(
      ((await history.json()) as { data: KubernetesDeploymentOperation[] }).data
        .length,
      3,
    );
    const forbidden = await fetch(
      `${baseUrl}/deployments/operations/${firstOperation.data.id}`,
      { headers: { authorization: `Bearer ${otherToken}` } },
    );
    assert.equal(forbidden.status, 404);
  } finally {
    server.close();
  }
});
