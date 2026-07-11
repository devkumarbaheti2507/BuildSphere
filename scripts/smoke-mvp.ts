import assert from "node:assert/strict";

const apiUrl = process.env.API_URL ?? "http://localhost:8080/api";
const smokeKubeconfig = `apiVersion: v1
kind: Config
clusters:
  - name: smoke-cluster
    cluster:
      server: https://127.0.0.1:6443
      certificate-authority-data: c21va2UtY2EtZGF0YQ==
contexts:
  - name: smoke-context
    context:
      cluster: smoke-cluster
      user: smoke-user
      namespace: smoke
current-context: smoke-context
users:
  - name: smoke-user
    user:
      token: smoke-kubeconfig-secret
`;

const request = async <T>(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<T> => {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers });
  const body = (await response.json().catch(() => undefined)) as
    { data?: T; error?: { code: string; message: string } } | undefined;
  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path}: ${body?.error?.code ?? response.status} ${body?.error?.message ?? ""}`,
    );
  }
  return body?.data as T;
};

const main = async (): Promise<void> => {
  const email = `smoke-${Date.now()}@example.com`;
  const session = await request<{
    accessToken: string;
    user: { id: string };
  }>("/auth/register", undefined, {
    method: "POST",
    body: JSON.stringify({
      name: "Smoke Test User",
      email,
      password: "StrongPassword123",
    }),
  });
  const token = session.accessToken;

  const project = await request<{ id: string; name: string }>(
    "/projects",
    token,
    {
      method: "POST",
      body: JSON.stringify({
        name: "Smoke Delivery Platform",
        description: "End-to-end BuildSphere verification",
        architectureType: "microservices",
        visibility: "private",
      }),
    },
  );

  const selections = [
    ["frontend", "react"],
    ["backend", "nodejs"],
    ["database", "postgresql"],
    ["cache", "redis"],
    ["ci", "github-actions"],
    ["container", "docker"],
    ["deployment", "kubernetes"],
    ["monitoring", "prometheus"],
    ["packaging", "helm"],
    ["infrastructure", "terraform-aws-eks"],
  ].map(([category, toolKey]) => ({ category, toolKey, config: {} }));
  await request(`/projects/${project.id}/tool-selections`, token, {
    method: "POST",
    body: JSON.stringify({ selections }),
  });

  const artifact = await request<{
    id: string;
    files: Array<{ path: string; content: string }>;
  }>(`/projects/${project.id}/generate`, token, {
    method: "POST",
    body: "{}",
  });
  assert.ok(artifact.files.some((file) => file.path === "backend/Dockerfile"));
  assert.equal(artifact.files.length, 26);
  assert.ok(artifact.files.some((file) => file.path === "helm/Chart.yaml"));
  assert.ok(
    artifact.files.some(
      (file) =>
        file.path === "helm/templates/deployment.yaml" &&
        file.content.includes("{{ .Values.replicaCount }}"),
    ),
  );
  assert.ok(artifact.files.some((file) => file.path === "terraform/main.tf"));
  assert.ok(
    artifact.files.some(
      (file) =>
        file.path === "terraform/variables.tf" &&
        /variable "enable_cluster"[\s\S]*?default\s*=\s*false/.test(
          file.content,
        ),
    ),
  );

  const pipelines = await request<Array<{ id: string; stages: unknown[] }>>(
    `/projects/${project.id}/pipelines`,
    token,
  );
  assert.equal(pipelines.length, 1);
  assert.equal(pipelines[0].stages.length, 7);

  const execution = await request<{ id: string; status: string }>(
    `/pipelines/${pipelines[0].id}/executions`,
    token,
    { method: "POST", body: "{}" },
  );
  let current = execution;
  for (
    let attempt = 0;
    attempt < 30 &&
    !["succeeded", "failed", "cancelled"].includes(current.status);
    attempt += 1
  ) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    current = await request(`/executions/${execution.id}`, token);
  }
  assert.equal(current.status, "succeeded");

  const logs = await request<unknown[]>(
    `/executions/${execution.id}/logs`,
    token,
  );
  assert.equal(logs.length, 14);
  const suggestions = await request<unknown[]>(
    `/projects/${project.id}/suggestions`,
    token,
  );
  assert.ok(suggestions.length > 0);

  const validation = await request<{ valid: boolean }>(
    "/deployments/validate",
    token,
    {
      method: "POST",
      body: JSON.stringify({
        manifests: artifact.files
          .filter((file) => file.path.startsWith("kubernetes/"))
          .map(({ path, content }) => ({ path, content })),
      }),
    },
  );
  assert.equal(validation.valid, true);

  const deploymentCapabilities = await request<{
    executionEnabled: boolean;
    supportedKinds: string[];
  }>("/deployments/capabilities", token);
  assert.equal(typeof deploymentCapabilities.executionEnabled, "boolean");
  assert.ok(deploymentCapabilities.supportedKinds.includes("Deployment"));
  assert.equal("allowedServerHosts" in deploymentCapabilities, false);

  const inspection = await request<{
    valid: boolean;
    connection: { serverHost: string; credentialMechanism: string };
    clusterRequestMade: boolean;
  }>("/deployments/kubernetes/inspect", token, {
    method: "POST",
    body: JSON.stringify({ kubeconfig: smokeKubeconfig }),
  });
  assert.equal(inspection.valid, true);
  assert.equal(inspection.connection.serverHost, "127.0.0.1:6443");
  assert.equal(inspection.connection.credentialMechanism, "token");
  assert.equal(inspection.clusterRequestMade, false);
  assert.equal(
    JSON.stringify(inspection).includes("smoke-kubeconfig-secret"),
    false,
  );

  const deploymentTarget = await request<{
    id: string;
    config: { connectionStatus: string };
  }>("/deployments/targets", token, {
    method: "POST",
    body: JSON.stringify({
      projectId: project.id,
      name: "Smoke cluster",
      type: "kubernetes",
      environment: "development",
      kubeconfig: smokeKubeconfig,
    }),
  });
  assert.equal(deploymentTarget.config.connectionStatus, "inspected");
  assert.equal(
    JSON.stringify(deploymentTarget).includes("smoke-kubeconfig-secret"),
    false,
  );
  const deploymentPlan = await request<{
    executable: boolean;
    clusterRequestMade: boolean;
    resources: unknown[];
  }>("/deployments/plans", token, {
    method: "POST",
    body: JSON.stringify({
      targetId: deploymentTarget.id,
      manifests: artifact.files
        .filter((file) => file.path.startsWith("kubernetes/"))
        .map(({ path, content }) => ({ path, content })),
    }),
  });
  assert.equal(deploymentPlan.executable, false);
  assert.equal(deploymentPlan.clusterRequestMade, false);
  assert.equal(deploymentPlan.resources.length, 4);
  const deploymentOperations = await request<unknown[]>(
    `/projects/${project.id}/deployment-operations`,
    token,
  );
  assert.equal(deploymentOperations.length, 0);
  const health = await request<{ status: string; services: unknown[] }>(
    "/monitoring/health",
    token,
  );
  assert.equal(health.status, "ok");
  const notifications = await request<Array<{ id: string; readAt?: string }>>(
    "/notifications",
    token,
  );
  assert.ok(notifications.length >= 4);
  const unreadNotification = notifications.find(
    (notification) => !notification.readAt,
  );
  assert.ok(unreadNotification);
  const markedNotification = await request<{ id: string; readAt?: string }>(
    `/notifications/${unreadNotification.id}/read`,
    token,
    { method: "PATCH" },
  );
  assert.equal(markedNotification.id, unreadNotification.id);
  assert.ok(markedNotification.readAt);
  const refreshedNotifications = await request<
    Array<{ id: string; readAt?: string }>
  >("/notifications", token);
  assert.equal(
    refreshedNotifications.find(
      (notification) => notification.id === unreadNotification.id,
    )?.readAt,
    markedNotification.readAt,
  );

  console.log(
    JSON.stringify(
      {
        status: "passed",
        projectId: project.id,
        generatedFiles: artifact.files.length,
        pipelineStages: pipelines[0].stages.length,
        pipelineLogs: logs.length,
        suggestions: suggestions.length,
        deploymentPlanResources: deploymentPlan.resources.length,
        deploymentOperations: deploymentOperations.length,
        monitoredServices: health.services.length,
        notifications: notifications.length,
        notificationsMarkedRead: 1,
      },
      null,
      2,
    ),
  );
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
