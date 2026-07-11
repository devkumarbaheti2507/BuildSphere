import assert from "node:assert/strict";
import test from "node:test";
import type { DeploymentTarget } from "@buildsphere/shared-types";
import { buildDeploymentPlan, DeploymentPlanError } from "./planner.js";

const target: DeploymentTarget = {
  id: "27e764f6-c0e3-45bb-a462-3a1309fc7dc5",
  projectId: "b896e2f2-f0aa-4754-9073-20985ebd7067",
  name: "Test cluster",
  type: "kubernetes",
  environment: "development",
  config: {
    connectionStatus: "inspected",
    connection: {
      context: "test",
      cluster: "test",
      serverHost: "cluster.example.com",
      namespace: "default",
      credentialMechanism: "token",
      tlsVerification: "enabled",
      contextCount: 1,
    },
  },
  createdAt: "2026-07-11T00:00:00.000Z",
  updatedAt: "2026-07-11T00:00:00.000Z",
};

test("deployment planning rejects populated Kubernetes Secret resources", () => {
  assert.throws(
    () =>
      buildDeploymentPlan(target, [
        {
          path: "kubernetes/namespace.yaml",
          content:
            "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: default\n",
        },
        {
          path: "kubernetes/deployment.yaml",
          content:
            "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: api\n  labels:\n    app: api\nspec:\n  template:\n    spec:\n      readinessProbe: {}\n      livenessProbe: {}\n      resources: {}\n",
        },
        {
          path: "kubernetes/service.yaml",
          content: "apiVersion: v1\nkind: Service\nmetadata:\n  name: api\n",
        },
        {
          path: "kubernetes/secret.yaml",
          content:
            "apiVersion: v1\nkind: Secret\nmetadata:\n  name: credentials\nstringData:\n  password: forbidden\n",
        },
      ]),
    (error: unknown) =>
      error instanceof DeploymentPlanError &&
      error.code === "MANIFEST_SECRET_DATA_FORBIDDEN",
  );
});
