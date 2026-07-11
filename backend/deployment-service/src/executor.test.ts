import assert from "node:assert/strict";
import test from "node:test";
import type { KubernetesObject } from "@kubernetes/client-node";
import type { DeploymentTarget } from "@buildsphere/shared-types";
import {
  buildExecutableManifestBundle,
  ExecutableManifestError,
} from "./executable-manifests.js";
import type { KubernetesExecutionPolicy } from "./execution-policy.js";
import { KubernetesExecutionError, KubernetesExecutor } from "./executor.js";
import {
  KubernetesRequestError,
  type KubernetesResourceClient,
} from "./kubernetes-client.js";

const target: DeploymentTarget = {
  id: "f5ee2fe0-c474-45e1-b780-b34dd9e803fd",
  projectId: "c0bcf32f-53ac-46e8-b03d-0e7485978995",
  name: "Executor test",
  type: "kubernetes",
  environment: "development",
  config: {
    connectionStatus: "connected",
    connection: {
      context: "test",
      cluster: "test",
      serverHost: "127.0.0.1:6443",
      namespace: "buildsphere-test",
      credentialMechanism: "token",
      tlsVerification: "enabled",
      contextCount: 1,
    },
    credentialStoredAt: "2026-07-11T12:00:00.000Z",
  },
  createdAt: "2026-07-11T12:00:00.000Z",
  updatedAt: "2026-07-11T12:00:00.000Z",
};

const baseFiles = [
  {
    path: "kubernetes/namespace.yaml",
    content:
      "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: buildsphere-test\n",
  },
  {
    path: "kubernetes/deployment.yaml",
    content:
      "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: api\n  namespace: buildsphere-test\n  labels:\n    app: api\nspec:\n  replicas: 1\n  template:\n    spec:\n      containers: []\n      readinessProbe: {}\n      livenessProbe: {}\n      resources: {}\n",
  },
  {
    path: "kubernetes/service.yaml",
    content:
      "apiVersion: v1\nkind: Service\nmetadata:\n  name: api\n  namespace: buildsphere-test\n",
  },
];

const policy: KubernetesExecutionPolicy = {
  allowedServerHosts: new Set(["127.0.0.1:6443"]),
  allowedEnvironments: new Set(["development"]),
  approvalTtlSeconds: 300,
  requestTimeoutMs: 1_000,
  operationTimeoutMs: 5_000,
  maxAttempts: 3,
};

const ownership = {
  ownerId: "1722a16e-ad23-4432-b95a-613818009763",
  projectId: target.projectId,
  targetId: target.id,
  operationId: "b6cc0a04-e5fa-41d2-82f8-354bd14346a0",
  artifactId: "81adf068-0272-48c3-a120-b926c8b105ba",
};

const key = (resource: KubernetesObject): string =>
  [
    resource.apiVersion,
    resource.kind,
    resource.metadata?.namespace ?? "",
    resource.metadata?.name,
  ].join("|");

class FakeKubernetesClient implements KubernetesResourceClient {
  readonly objects = new Map<string, KubernetesObject>();
  readonly applied: KubernetesObject[] = [];
  readonly deleted: KubernetesObject[] = [];
  transientServiceFailure = false;
  private serviceFailed = false;

  async read(resource: KubernetesObject) {
    const value = this.objects.get(key(resource));
    return value ? structuredClone(value) : undefined;
  }

  async apply(resource: KubernetesObject) {
    if (
      this.transientServiceFailure &&
      resource.kind === "Service" &&
      !this.serviceFailed
    ) {
      this.serviceFailed = true;
      throw new KubernetesRequestError(
        "KUBERNETES_API_UNAVAILABLE",
        "temporary",
        503,
        true,
      );
    }
    this.applied.push(structuredClone(resource));
    this.objects.set(key(resource), structuredClone(resource));
  }

  async delete(resource: KubernetesObject) {
    this.deleted.push(structuredClone(resource));
    this.objects.delete(key(resource));
  }
}

test("execution bundles reject namespace escape and all Secret resources", () => {
  assert.throws(
    () =>
      buildExecutableManifestBundle(
        target,
        baseFiles.map((file) =>
          file.path.endsWith("service.yaml")
            ? {
                ...file,
                content: file.content.replace(
                  "namespace: buildsphere-test",
                  "namespace: other",
                ),
              }
            : file,
        ),
        true,
      ),
    (error: unknown) =>
      error instanceof ExecutableManifestError &&
      error.code === "KUBERNETES_NAMESPACE_MISMATCH",
  );
  assert.throws(
    () =>
      buildExecutableManifestBundle(
        target,
        [
          ...baseFiles,
          {
            path: "kubernetes/secret.yaml",
            content:
              "apiVersion: v1\nkind: Secret\nmetadata:\n  name: empty\n  namespace: buildsphere-test\n",
          },
        ],
        true,
      ),
    (error: unknown) =>
      error instanceof ExecutableManifestError &&
      error.code === "KUBERNETES_SECRET_FORBIDDEN",
  );
});

test("executor prechecks ownership, labels applies, and retries transient requests", async () => {
  const client = new FakeKubernetesClient();
  client.transientServiceFailure = true;
  client.objects.set("v1|Namespace||buildsphere-test", {
    apiVersion: "v1",
    kind: "Namespace",
    metadata: { name: "buildsphere-test" },
  });
  const executor = new KubernetesExecutor(policy, async () => {});
  const result = await executor.apply(
    client,
    buildExecutableManifestBundle(target, baseFiles, true),
    ownership,
  );

  assert.equal(
    result.resources.find((resource) => resource.kind === "Namespace")?.status,
    "retained",
  );
  assert.equal(
    result.resources.find((resource) => resource.kind === "Service")?.attempts,
    2,
  );
  assert.equal(client.applied.length, 2);
  for (const applied of client.applied) {
    assert.equal(
      applied.metadata?.labels?.["app.kubernetes.io/managed-by"],
      "buildsphere",
    );
    assert.equal(
      applied.metadata?.labels?.["buildsphere.dev/target-id"],
      target.id,
    );
  }
});

test("executor rejects an existing resource before any mutation when ownership differs", async () => {
  const client = new FakeKubernetesClient();
  client.objects.set("v1|Service|buildsphere-test|api", {
    apiVersion: "v1",
    kind: "Service",
    metadata: { name: "api", namespace: "buildsphere-test" },
  });
  const executor = new KubernetesExecutor(policy, async () => {});
  await assert.rejects(
    executor.apply(
      client,
      buildExecutableManifestBundle(target, baseFiles, true),
      ownership,
    ),
    (error: unknown) =>
      error instanceof KubernetesExecutionError &&
      error.code === "KUBERNETES_RESOURCE_OWNERSHIP_CONFLICT",
  );
  assert.equal(client.applied.length, 0);
});

test("rollback reapplies the prior snapshot and prunes only owned namespaced additions", async () => {
  const client = new FakeKubernetesClient();
  client.objects.set("v1|Namespace||buildsphere-test", {
    apiVersion: "v1",
    kind: "Namespace",
    metadata: { name: "buildsphere-test" },
  });
  const executor = new KubernetesExecutor(policy, async () => {});
  const previous = buildExecutableManifestBundle(target, baseFiles, true);
  const current = buildExecutableManifestBundle(
    target,
    [
      ...baseFiles,
      {
        path: "kubernetes/configmap.yaml",
        content:
          "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: release-only\n  namespace: buildsphere-test\n",
      },
    ],
    true,
  );
  await executor.apply(client, current, ownership);
  const result = await executor.rollback(client, current, previous, ownership);

  assert.equal(client.deleted.length, 1);
  assert.equal(client.deleted[0].kind, "ConfigMap");
  assert.equal(client.deleted[0].metadata?.name, "release-only");
  assert.equal(
    result.resources.some(
      (resource) =>
        resource.kind === "ConfigMap" && resource.status === "deleted",
    ),
    true,
  );
  assert.equal(
    client.deleted.some((resource) => resource.kind === "Namespace"),
    false,
  );
});
