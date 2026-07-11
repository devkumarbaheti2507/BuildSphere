import assert from "node:assert/strict";
import test from "node:test";
import { inspectKubeconfig, KubeconfigInspectionError } from "./kubeconfig.js";

test("kubeconfig inspection returns only allowlisted connection metadata", () => {
  const result = inspectKubeconfig(`apiVersion: v1
kind: Config
clusters:
  - name: demo
    cluster:
      server: https://cluster.example.com:6443/path
      certificate-authority-data: hidden-ca
contexts:
  - name: demo-context
    context:
      cluster: demo
      user: demo-user
current-context: demo-context
users:
  - name: demo-user
    user:
      client-certificate-data: hidden-certificate
      client-key-data: hidden-private-key
`);

  assert.deepEqual(result.connection, {
    context: "demo-context",
    cluster: "demo",
    serverHost: "cluster.example.com:6443",
    namespace: "default",
    credentialMechanism: "client-certificate",
    tlsVerification: "enabled",
    contextCount: 1,
  });
  assert.equal(result.clusterRequestMade, false);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("hidden-certificate"), false);
  assert.equal(serialized.includes("hidden-private-key"), false);
  assert.equal(serialized.includes("hidden-ca"), false);
});

test("kubeconfig inspection rejects local file references before client parsing", () => {
  assert.throws(
    () =>
      inspectKubeconfig(`apiVersion: v1
kind: Config
clusters:
  - name: demo
    cluster:
      server: https://cluster.example.com
contexts:
  - name: demo
    context:
      cluster: demo
      user: demo
current-context: demo
users:
  - name: demo
    user:
      token-file: /etc/passwd
`),
    (error: unknown) =>
      error instanceof KubeconfigInspectionError &&
      error.code === "KUBECONFIG_FILE_REFERENCE_FORBIDDEN",
  );
});

test("kubeconfig inspection rejects an unresolved current context", () => {
  assert.throws(
    () =>
      inspectKubeconfig(`apiVersion: v1
kind: Config
clusters:
  - name: demo
    cluster:
      server: https://cluster.example.com
contexts: []
current-context: missing
users: []
`),
    (error: unknown) =>
      error instanceof KubeconfigInspectionError &&
      error.code === "KUBECONFIG_CONTEXT_INVALID",
  );
});
