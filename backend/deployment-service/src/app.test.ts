import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { signToken } from "@buildsphere/service-core";
import { createDeploymentApp } from "./app.js";
import { InMemoryDeploymentRepository } from "./repository.js";
import { validateKubernetesManifests } from "./validator.js";

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
  } finally {
    server.close();
  }
});
