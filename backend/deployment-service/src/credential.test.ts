import assert from "node:assert/strict";
import test from "node:test";
import { KubeConfig } from "@kubernetes/client-node";
import {
  ExecutionCredentialError,
  KubernetesCredentialCipher,
  prepareKubeconfigForExecution,
} from "./credential.js";
import type { KubernetesExecutionPolicy } from "./execution-policy.js";

const policy: KubernetesExecutionPolicy = {
  allowedServerHosts: new Set(["cluster.example.com:6443"]),
  allowedEnvironments: new Set(["development"]),
  approvalTtlSeconds: 300,
  requestTimeoutMs: 1_000,
  operationTimeoutMs: 5_000,
  maxAttempts: 3,
};

const kubeconfig = `apiVersion: v1
kind: Config
clusters:
  - name: selected
    cluster:
      server: https://cluster.example.com:6443
      certificate-authority-data: c2VsZWN0ZWQtY2E=
  - name: unused
    cluster:
      server: https://unused.example.com
contexts:
  - name: selected
    context:
      cluster: selected
      user: selected
      namespace: buildsphere-test
  - name: unused
    context:
      cluster: unused
      user: unused
current-context: selected
users:
  - name: selected
    user:
      token: selected-secret-token
  - name: unused
    user:
      token: unused-secret-token
`;

test("Kubernetes credential encryption is authenticated and target bound", () => {
  const cipher = new KubernetesCredentialCipher(
    Buffer.alloc(32, 9).toString("base64"),
  );
  const encrypted = cipher.encrypt(
    "credential-source",
    "owner-one",
    "target-one",
  );
  assert.equal(encrypted.includes("credential-source"), false);
  assert.equal(
    cipher.decrypt(encrypted, "owner-one", "target-one"),
    "credential-source",
  );
  assert.throws(
    () => cipher.decrypt(encrypted, "owner-one", "target-two"),
    (error: unknown) =>
      error instanceof ExecutionCredentialError &&
      error.code === "KUBERNETES_CREDENTIAL_INVALID",
  );
});

test("execution credential preparation keeps only the selected embedded context", () => {
  const prepared = prepareKubeconfigForExecution(kubeconfig, policy);
  assert.equal(prepared.connection.serverHost, "cluster.example.com:6443");
  assert.equal(prepared.kubeconfig.includes("selected-secret-token"), true);
  assert.equal(prepared.kubeconfig.includes("unused-secret-token"), false);
  assert.equal(prepared.kubeconfig.includes("unused.example.com"), false);
  assert.match(prepared.fingerprint, /^[a-f0-9]{64}$/);

  const minimized = new KubeConfig();
  minimized.loadFromString(prepared.kubeconfig);
  assert.equal(minimized.contexts.length, 1);
  assert.equal(minimized.clusters.length, 1);
  assert.equal(minimized.users.length, 1);
  assert.equal(minimized.getCurrentContext(), "selected");
});

test("execution credential preparation rejects dynamic commands and proxy bypass", () => {
  assert.throws(
    () =>
      prepareKubeconfigForExecution(
        kubeconfig.replace(
          "      token: selected-secret-token",
          "      token: selected-secret-token\n      exec:\n        command: malicious-command",
        ),
        policy,
      ),
    (error: unknown) =>
      error instanceof ExecutionCredentialError &&
      error.code === "KUBERNETES_DYNAMIC_CREDENTIAL_FORBIDDEN",
  );
  assert.throws(
    () =>
      prepareKubeconfigForExecution(
        kubeconfig.replace(
          "      certificate-authority-data: c2VsZWN0ZWQtY2E=",
          "      certificate-authority-data: c2VsZWN0ZWQtY2E=\n      proxy-url: http://127.0.0.1:8080",
        ),
        policy,
      ),
    (error: unknown) =>
      error instanceof ExecutionCredentialError &&
      error.code === "KUBERNETES_PROXY_FORBIDDEN",
  );
});

test("execution credential preparation rejects non-allowlisted and insecure servers", () => {
  assert.throws(
    () =>
      prepareKubeconfigForExecution(
        kubeconfig.replace(
          "cluster.example.com:6443",
          "internal.example.com:6443",
        ),
        policy,
      ),
    (error: unknown) =>
      error instanceof ExecutionCredentialError &&
      error.code === "KUBERNETES_SERVER_NOT_ALLOWED",
  );
  assert.throws(
    () =>
      prepareKubeconfigForExecution(
        kubeconfig.replace("https://cluster", "http://cluster"),
        policy,
      ),
    (error: unknown) =>
      error instanceof ExecutionCredentialError &&
      error.code === "KUBERNETES_TLS_REQUIRED",
  );
});
