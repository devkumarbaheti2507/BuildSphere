import { useEffect, useState } from "react";
import type {
  DeploymentEnvironment,
  DeploymentTarget,
  GeneratedArtifact,
  GeneratedFile,
  GitHubRepositorySummary,
  GitHubWorkflowRun,
  KubernetesConnectionInspection,
  KubernetesDeploymentApproval,
  KubernetesDeploymentOperation,
  KubernetesDeploymentPlan,
  KubernetesExecutionCapabilities,
  ManifestValidationResult,
  PipelineDefinition,
  PipelineExecutionSummary,
  PipelineLog,
  ProjectSummary,
  Suggestion,
} from "@buildsphere/shared-types";
import { api, ApiClientError } from "../api";
import { navigate } from "../navigation";

type Tab =
  "overview" | "files" | "pipeline" | "github" | "suggestions" | "deployment";
const terminalStatuses = ["succeeded", "failed", "cancelled"];

export function ProjectPage({
  token,
  projectId,
}: {
  token: string;
  projectId: string;
}) {
  const [project, setProject] = useState<ProjectSummary>();
  const [artifacts, setArtifacts] = useState<GeneratedArtifact[]>([]);
  const [pipelines, setPipelines] = useState<PipelineDefinition[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [targets, setTargets] = useState<DeploymentTarget[]>([]);
  const [githubRepository, setGitHubRepository] =
    useState<GitHubRepositorySummary>();
  const [githubRuns, setGitHubRuns] = useState<GitHubWorkflowRun[]>([]);
  const [githubEnabled, setGitHubEnabled] = useState(false);
  const [execution, setExecution] = useState<PipelineExecutionSummary>();
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedFile, setSelectedFile] = useState<GeneratedFile>();
  const [validation, setValidation] = useState<ManifestValidationResult>();
  const [connectionInspection, setConnectionInspection] =
    useState<KubernetesConnectionInspection>();
  const [deploymentPlan, setDeploymentPlan] =
    useState<KubernetesDeploymentPlan>();
  const [deploymentCapabilities, setDeploymentCapabilities] =
    useState<KubernetesExecutionCapabilities>();
  const [deploymentOperations, setDeploymentOperations] = useState<
    KubernetesDeploymentOperation[]
  >([]);
  const [deploymentApproval, setDeploymentApproval] =
    useState<KubernetesDeploymentApproval>();
  const [rollbackApproval, setRollbackApproval] =
    useState<KubernetesDeploymentApproval>();
  const [activeDeployment, setActiveDeployment] =
    useState<KubernetesDeploymentOperation>();
  const [targetName, setTargetName] = useState("Local cluster");
  const [environment, setEnvironment] =
    useState<DeploymentEnvironment>("development");
  const [repositoryName, setRepositoryName] = useState("");
  const [repositoryPrivate, setRepositoryPrivate] = useState(true);
  const [kubeconfig, setKubeconfig] = useState("");
  const [kubeconfigFileName, setKubeconfigFileName] = useState("");
  const [kubeconfigInputKey, setKubeconfigInputKey] = useState(0);
  const [retainCredential, setRetainCredential] = useState(false);
  const [deploymentConfirmed, setDeploymentConfirmed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [
        nextProject,
        nextArtifacts,
        nextPipelines,
        nextSuggestions,
        nextTargets,
        nextCapabilities,
        nextDeploymentOperations,
      ] = await Promise.all([
        api.project(token, projectId),
        api.artifacts(token, projectId),
        api.pipelines(token, projectId),
        api.suggestions(token, projectId),
        api.targets(token, projectId),
        api.deploymentCapabilities(token),
        api.deploymentOperations(token, projectId),
      ]);
      setProject(nextProject);
      setArtifacts(nextArtifacts);
      setPipelines(nextPipelines);
      setSuggestions(nextSuggestions);
      setTargets(nextTargets);
      setDeploymentCapabilities(nextCapabilities);
      setDeploymentOperations(nextDeploymentOperations);
      setRepositoryName(
        (current) =>
          current ||
          nextProject.name
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, "-")
            .replace(/^-|-$/g, ""),
      );
      setRepositoryPrivate(nextProject.visibility === "private");
      if (!selectedFile && nextArtifacts[0]?.files[0])
        setSelectedFile(nextArtifacts[0].files[0]);
      if (nextPipelines[0]) {
        const executions = await api.executions(token, nextPipelines[0].id);
        if (executions[0]) {
          setExecution(executions[0]);
          setLogs(await api.logs(token, executions[0].id));
        }
      }
      const providers = await api.authProviders().catch(() => ({
        github: { enabled: false },
      }));
      setGitHubEnabled(providers.github.enabled);
      if (providers.github.enabled) {
        const linked = await api
          .githubRepository(token, projectId)
          .catch(() => null);
        setGitHubRepository(linked ?? undefined);
        setGitHubRuns(
          linked ? await api.githubRuns(token, projectId).catch(() => []) : [],
        );
      }
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Unable to load project",
      );
    }
  };
  useEffect(() => {
    setKubeconfig("");
    setKubeconfigFileName("");
    setConnectionInspection(undefined);
    setDeploymentPlan(undefined);
    setDeploymentApproval(undefined);
    setRollbackApproval(undefined);
    setActiveDeployment(undefined);
    setDeploymentConfirmed(false);
    void load();
  }, [projectId]);

  const generate = async () => {
    if (!project) return;
    setBusy("generate");
    setError("");
    try {
      const artifact = await api.generate(token, project.id);
      await load();
      setTab("files");
      setSelectedFile(artifact.files[0]);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : "Generation failed",
      );
    } finally {
      setBusy("");
    }
  };

  const pollExecution = async (
    executionId: string,
    attempts = 0,
  ): Promise<void> => {
    const next = await api.execution(token, executionId);
    setExecution(next);
    setLogs(await api.logs(token, executionId));
    if (!terminalStatuses.includes(next.status) && attempts < 60) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      return pollExecution(executionId, attempts + 1);
    }
  };
  const runPipeline = async (failStageKey?: string) => {
    let pipeline = pipelines[0];
    setBusy("pipeline");
    setError("");
    try {
      if (!pipeline && project) {
        pipeline = await api.createPipeline(
          token,
          project.id,
          `${project.name} pipeline`,
        );
        setPipelines([pipeline]);
      }
      if (!pipeline) return;
      const started = await api.startExecution(
        token,
        pipeline.id,
        failStageKey,
      );
      setExecution(started);
      setTab("pipeline");
      await pollExecution(started.id);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Pipeline execution failed",
      );
    } finally {
      setBusy("");
    }
  };
  const updateSuggestion = async (
    suggestion: Suggestion,
    status: "accepted" | "dismissed",
  ) => {
    await api.updateSuggestion(token, suggestion.id, status);
    setSuggestions(await api.suggestions(token, projectId));
  };
  const analyze = async () => {
    if (!project) return;
    setBusy("analyze");
    try {
      setSuggestions(await api.analyze(token, project, artifacts[0]));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed");
    } finally {
      setBusy("");
    }
  };
  const validate = async () => {
    if (!artifacts[0]) return;
    setBusy("validate");
    try {
      setValidation(await api.validateManifests(token, artifacts[0]));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Validation failed");
    } finally {
      setBusy("");
    }
  };
  const createTarget = async () => {
    setBusy("target");
    setError("");
    try {
      const created = await api.createTarget(
        token,
        projectId,
        targetName,
        environment,
        kubeconfig || undefined,
      );
      if (
        retainCredential &&
        kubeconfig &&
        deploymentCapabilities?.executionEnabled
      ) {
        await api.storeTargetCredential(token, created.id, kubeconfig);
      }
      setTargets(await api.targets(token, projectId));
      setKubeconfig("");
      setKubeconfigFileName("");
      setConnectionInspection(undefined);
      setRetainCredential(false);
      setKubeconfigInputKey((current) => current + 1);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Target creation failed",
      );
    } finally {
      setBusy("");
    }
  };

  const chooseKubeconfig = async (file?: File) => {
    setConnectionInspection(undefined);
    setKubeconfig("");
    setKubeconfigFileName(file?.name ?? "");
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError("Kubeconfig files must be 1 MiB or smaller.");
      return;
    }
    try {
      setKubeconfig(await file.text());
      setError("");
    } catch {
      setError("The kubeconfig file could not be read.");
    }
  };

  const inspectConnection = async () => {
    if (!kubeconfig) return;
    setBusy("connection-inspect");
    setError("");
    try {
      setConnectionInspection(await api.inspectKubeconfig(token, kubeconfig));
    } catch (caught) {
      setConnectionInspection(undefined);
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Kubeconfig inspection failed",
      );
    } finally {
      setBusy("");
    }
  };

  const buildPlan = async (target: DeploymentTarget) => {
    const latestArtifact = artifacts[0];
    if (!latestArtifact) return;
    setBusy(`plan-${target.id}`);
    setError("");
    try {
      setDeploymentApproval(undefined);
      setRollbackApproval(undefined);
      setDeploymentConfirmed(false);
      setDeploymentPlan(
        await api.deploymentPlan(token, target.id, latestArtifact),
      );
    } catch (caught) {
      setDeploymentPlan(undefined);
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Deployment planning failed",
      );
    } finally {
      setBusy("");
    }
  };

  const connectTarget = async (target: DeploymentTarget) => {
    if (!kubeconfig || !connectionInspection) return;
    setBusy(`connect-${target.id}`);
    setError("");
    try {
      await api.storeTargetCredential(token, target.id, kubeconfig);
      setTargets(await api.targets(token, projectId));
      setKubeconfig("");
      setKubeconfigFileName("");
      setConnectionInspection(undefined);
      setKubeconfigInputKey((current) => current + 1);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Credential connection failed",
      );
    } finally {
      setBusy("");
    }
  };

  const revokeTarget = async (target: DeploymentTarget) => {
    setBusy(`revoke-${target.id}`);
    setError("");
    try {
      await api.revokeTargetCredential(token, target.id);
      setTargets(await api.targets(token, projectId));
      if (deploymentPlan?.targetId === target.id) {
        setDeploymentApproval(undefined);
        setDeploymentConfirmed(false);
      }
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Credential revocation failed",
      );
    } finally {
      setBusy("");
    }
  };

  const approveDeployment = async () => {
    if (!deploymentPlan || !artifact || !deploymentConfirmed) return;
    setBusy("deployment-approve");
    setError("");
    try {
      setDeploymentApproval(
        await api.createDeploymentApproval(
          token,
          deploymentPlan.targetId,
          artifact.id,
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Deployment approval failed",
      );
    } finally {
      setBusy("");
    }
  };

  const executeDeployment = async () => {
    if (!deploymentApproval) return;
    setBusy("deployment-execute");
    setError("");
    try {
      const operation = await api.executeDeployment(
        token,
        deploymentApproval.id,
        crypto.randomUUID(),
      );
      setActiveDeployment(operation);
      setDeploymentApproval(undefined);
      setDeploymentConfirmed(false);
      setDeploymentOperations(await api.deploymentOperations(token, projectId));
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Deployment execution failed",
      );
    } finally {
      setBusy("");
    }
  };

  const refreshDeployment = async (
    operation: KubernetesDeploymentOperation,
  ) => {
    setBusy(`deployment-refresh-${operation.id}`);
    setError("");
    try {
      const refreshed = await api.refreshDeploymentOperation(
        token,
        operation.id,
      );
      setActiveDeployment(refreshed);
      setDeploymentOperations(await api.deploymentOperations(token, projectId));
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Deployment status refresh failed",
      );
    } finally {
      setBusy("");
    }
  };

  const approveRollback = async (operation: KubernetesDeploymentOperation) => {
    setBusy(`rollback-approve-${operation.id}`);
    setError("");
    try {
      setRollbackApproval(
        await api.createRollbackApproval(token, operation.id),
      );
      setActiveDeployment(operation);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Rollback approval failed",
      );
    } finally {
      setBusy("");
    }
  };

  const executeRollback = async () => {
    if (!rollbackApproval?.sourceOperationId) return;
    setBusy("rollback-execute");
    setError("");
    try {
      const operation = await api.rollbackDeployment(
        token,
        rollbackApproval.sourceOperationId,
        rollbackApproval.id,
        crypto.randomUUID(),
      );
      setActiveDeployment(operation);
      setRollbackApproval(undefined);
      setDeploymentOperations(await api.deploymentOperations(token, projectId));
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : "Rollback failed",
      );
    } finally {
      setBusy("");
    }
  };

  const publishToGitHub = async () => {
    if (!artifact || !project) return;
    setBusy("github-publish");
    setError("");
    try {
      const linked = await api.publishGitHubRepository(token, projectId, {
        name: repositoryName,
        description: project.description,
        private: repositoryPrivate,
        artifactId: artifact.id,
      });
      setGitHubRepository(linked);
      setRepositoryName(linked.name);
      setRepositoryPrivate(linked.private);
      setTab("github");
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "GitHub publishing failed",
      );
    } finally {
      setBusy("");
    }
  };

  const synchronizeGitHubRuns = async () => {
    setBusy("github-sync");
    setError("");
    try {
      setGitHubRuns(await api.synchronizeGitHubRuns(token, projectId));
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "GitHub Actions synchronization failed",
      );
    } finally {
      setBusy("");
    }
  };

  if (!project)
    return <div className="loading-state">{error || "Loading project..."}</div>;
  const artifact = artifacts[0];
  const pipeline = pipelines[0];
  const plannedTarget = targets.find(
    (target) => target.id === deploymentPlan?.targetId,
  );
  const shownDeployment = activeDeployment ?? deploymentOperations[0];
  return (
    <>
      <button className="back-link" onClick={() => navigate("/dashboard")}>
        Back to dashboard
      </button>
      <div className="project-header">
        <div>
          <div className="heading-line">
            <h1>{project.name}</h1>
            <span className={`status ${project.status}`}>{project.status}</span>
          </div>
          <p>{project.description || "No project description"}</p>
        </div>
        <div className="header-actions">
          <button
            className="secondary-button"
            onClick={() =>
              void api
                .updateProject(token, project.id, {
                  status: project.status === "active" ? "archived" : "active",
                })
                .then(load)
            }
          >
            {project.status === "active" ? "Archive" : "Restore"}
          </button>
          <button
            className="primary-button"
            disabled={busy === "generate" || project.status === "archived"}
            onClick={generate}
          >
            {busy === "generate" ? "Generating..." : "Generate assets"}
          </button>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="tabs" role="tablist">
        {(
          [
            "overview",
            "files",
            "pipeline",
            "github",
            "suggestions",
            "deployment",
          ] as Tab[]
        ).map((item) => (
          <button
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? "active" : ""}
            key={item}
            onClick={() => setTab(item)}
          >
            {item === "files"
              ? `Generated files (${artifact?.files.length ?? 0})`
              : item === "suggestions"
                ? `Suggestions (${suggestions.filter((entry) => entry.status === "open").length})`
                : item}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section className="detail-grid">
          <div className="content-band">
            <div className="band-heading">
              <h2>Configuration</h2>
            </div>
            <dl className="review-list">
              <div>
                <dt>Architecture</dt>
                <dd>{project.architectureType}</dd>
              </div>
              <div>
                <dt>Visibility</dt>
                <dd>{project.visibility}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{new Date(project.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>
          <div className="content-band">
            <div className="band-heading">
              <h2>Selected tools</h2>
              <span>{project.toolSelections.length}</span>
            </div>
            <div className="tool-grid">
              {project.toolSelections.map((tool) => (
                <div key={tool.category}>
                  <span>{tool.category}</span>
                  <strong>{tool.toolKey}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "files" && (
        <section className="file-workbench">
          {artifact ? (
            <>
              <aside className="file-list">
                <div className="file-list-head">
                  <strong>Artifact</strong>
                  <button
                    className="small-button"
                    onClick={() => api.downloadArtifact(token, artifact.id)}
                  >
                    Download TAR
                  </button>
                </div>
                {artifact.files.map((file) => (
                  <button
                    key={file.path}
                    className={selectedFile?.path === file.path ? "active" : ""}
                    onClick={() => setSelectedFile(file)}
                  >
                    {file.path}
                  </button>
                ))}
              </aside>
              <div className="file-viewer">
                <div className="file-toolbar">
                  <span>{selectedFile?.path}</span>
                  <small>{selectedFile?.language}</small>
                </div>
                <pre>
                  <code>{selectedFile?.content}</code>
                </pre>
                <div className="learning-strip">
                  <strong>Why this file matters</strong>
                  <p>{selectedFile?.explanation}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h3>No generated files</h3>
              <p>Generate this project to create inspectable DevOps assets.</p>
              <button className="primary-button" onClick={generate}>
                Generate assets
              </button>
            </div>
          )}
        </section>
      )}

      {tab === "pipeline" && (
        <section className="pipeline-layout">
          <div className="pipeline-main">
            <div className="band-heading">
              <div>
                <h2>{pipeline?.name ?? "Pipeline not generated"}</h2>
                <span>
                  {execution
                    ? `Execution ${execution.status}`
                    : "No execution yet"}
                </span>
              </div>
              <div className="button-row">
                <button
                  className="secondary-button"
                  disabled={busy === "pipeline"}
                  onClick={() => runPipeline("run_tests")}
                >
                  Simulate failure
                </button>
                <button
                  className="primary-button"
                  disabled={busy === "pipeline"}
                  onClick={() => runPipeline()}
                >
                  {busy === "pipeline" ? "Running..." : "Run pipeline"}
                </button>
              </div>
            </div>
            {pipeline && (
              <div className="timeline">
                {pipeline.stages.map((stage) => {
                  const state =
                    execution?.stages.find((item) => item.key === stage.key)
                      ?.status ?? "pending";
                  return (
                    <div className={`timeline-stage ${state}`} key={stage.key}>
                      <span className="stage-index">{stage.order}</span>
                      <div>
                        <strong>{stage.name}</strong>
                        <p>{stage.description}</p>
                        <small>{state}</small>
                      </div>
                      <details>
                        <summary>Learning notes</summary>
                        <p>
                          <b>Why:</b> {stage.explanation.why}
                        </p>
                        <p>
                          <b>Common failures:</b>{" "}
                          {stage.explanation.commonFailures.join(", ")}
                        </p>
                        <p>
                          <b>Fixes:</b> {stage.explanation.fixes.join(", ")}
                        </p>
                      </details>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <aside className="log-viewer">
            <div className="file-toolbar">
              <span>Execution logs</span>
              <small>{logs.length} lines</small>
            </div>
            <div className="log-lines">
              {logs.length ? (
                logs.map((log) => (
                  <p key={log.id} className={log.level}>
                    <time>{new Date(log.timestamp).toLocaleTimeString()}</time>
                    <b>{log.stageKey}</b>
                    <span>{log.message}</span>
                  </p>
                ))
              ) : (
                <p className="quiet">Run the pipeline to produce logs.</p>
              )}
            </div>
          </aside>
        </section>
      )}

      {tab === "github" && (
        <section className="github-workspace">
          {!githubEnabled ? (
            <div className="empty-state">
              <h3>GitHub integration is not configured</h3>
              <p>
                The provider becomes available after the GitHub App settings are
                configured.
              </p>
            </div>
          ) : (
            <>
              <div className="content-band github-publisher">
                <div className="band-heading">
                  <div>
                    <h2>Repository publishing</h2>
                    <span>
                      {githubRepository
                        ? `${githubRepository.publishedFiles} files published`
                        : "No repository linked"}
                    </span>
                  </div>
                  {githubRepository && (
                    <a
                      className="secondary-button"
                      href={githubRepository.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open repository
                    </a>
                  )}
                </div>
                <div className="inline-form github-publish-form">
                  <label>
                    Repository name
                    <input
                      value={repositoryName}
                      disabled={Boolean(githubRepository)}
                      maxLength={100}
                      onChange={(event) =>
                        setRepositoryName(event.target.value)
                      }
                    />
                  </label>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={repositoryPrivate}
                      disabled={Boolean(githubRepository)}
                      onChange={(event) =>
                        setRepositoryPrivate(event.target.checked)
                      }
                    />
                    Private repository
                  </label>
                  <button
                    className="primary-button"
                    disabled={
                      !artifact || !repositoryName || busy === "github-publish"
                    }
                    onClick={publishToGitHub}
                  >
                    {busy === "github-publish"
                      ? "Publishing..."
                      : githubRepository
                        ? "Publish latest files"
                        : "Create and publish"}
                  </button>
                </div>
                {githubRepository && (
                  <dl className="review-list github-repository-details">
                    <div>
                      <dt>Repository</dt>
                      <dd>{githubRepository.fullName}</dd>
                    </div>
                    <div>
                      <dt>Default branch</dt>
                      <dd>{githubRepository.defaultBranch}</dd>
                    </div>
                    <div>
                      <dt>Visibility</dt>
                      <dd>{githubRepository.private ? "private" : "public"}</dd>
                    </div>
                    <div>
                      <dt>Last published</dt>
                      <dd>
                        {githubRepository.lastPublishedAt
                          ? new Date(
                              githubRepository.lastPublishedAt,
                            ).toLocaleString()
                          : "Pending"}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
              <div className="content-band github-actions-runs">
                <div className="band-heading">
                  <div>
                    <h2>GitHub Actions runs</h2>
                    <span>{githubRuns.length} synchronized</span>
                  </div>
                  <button
                    className="secondary-button"
                    disabled={!githubRepository || busy === "github-sync"}
                    onClick={synchronizeGitHubRuns}
                  >
                    {busy === "github-sync"
                      ? "Synchronizing..."
                      : "Synchronize"}
                  </button>
                </div>
                {githubRuns.length ? (
                  <div className="github-run-list">
                    {githubRuns.map((run) => (
                      <a
                        key={run.githubRunId}
                        href={run.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className={`status ${run.status}`}>
                          {run.status}
                        </span>
                        <strong>{run.name}</strong>
                        <span>#{run.runNumber}</span>
                        <span>{run.branch ?? "detached"}</span>
                        <span>{run.event}</span>
                        <time>{new Date(run.createdAt).toLocaleString()}</time>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="quiet">
                    {githubRepository
                      ? "Synchronize to load workflow runs."
                      : "Publish the project before synchronizing workflow runs."}
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {tab === "suggestions" && (
        <section className="suggestion-list">
          {suggestions.length ? (
            suggestions.map((suggestion) => (
              <article
                className={`suggestion ${suggestion.status}`}
                key={suggestion.id}
              >
                <div className="suggestion-head">
                  <span className={`severity ${suggestion.severity}`}>
                    {suggestion.severity}
                  </span>
                  <span>{suggestion.category}</span>
                  <small>
                    {Math.round(suggestion.confidence * 100)}% confidence
                  </small>
                </div>
                <h3>{suggestion.title}</h3>
                <p>{suggestion.description}</p>
                <div className="recommendation">
                  <strong>Recommended action</strong>
                  <p>{suggestion.recommendedAction}</p>
                </div>
                {suggestion.status === "open" ? (
                  <div className="button-row">
                    <button
                      className="secondary-button"
                      onClick={() => updateSuggestion(suggestion, "dismissed")}
                    >
                      Dismiss
                    </button>
                    <button
                      className="primary-button"
                      onClick={() => updateSuggestion(suggestion, "accepted")}
                    >
                      Accept
                    </button>
                  </div>
                ) : (
                  <span className={`status ${suggestion.status}`}>
                    {suggestion.status}
                  </span>
                )}
              </article>
            ))
          ) : (
            <div className="empty-state">
              <h3>No suggestions yet</h3>
              <p>
                Run the rule-based review against the latest project assets.
              </p>
              <button
                className="primary-button"
                disabled={busy === "analyze"}
                onClick={analyze}
              >
                {busy === "analyze" ? "Analyzing..." : "Analyze project"}
              </button>
            </div>
          )}
        </section>
      )}

      {tab === "deployment" && (
        <section className="detail-grid">
          <div className="content-band">
            <div className="band-heading">
              <h2>Manifest validation</h2>
              <button
                className="secondary-button"
                disabled={!artifact || busy === "validate"}
                onClick={validate}
              >
                {busy === "validate"
                  ? "Validating..."
                  : "Validate latest artifact"}
              </button>
            </div>
            {validation ? (
              <div
                className={
                  validation.valid ? "validation valid" : "validation invalid"
                }
              >
                <strong>
                  {validation.valid
                    ? "Deployment assets passed"
                    : "Deployment assets need attention"}
                </strong>
                {validation.errors.map((item) => (
                  <p key={item}>{item}</p>
                ))}
                {validation.warnings.map((item) => (
                  <p key={item} className="warning">
                    {item}
                  </p>
                ))}
              </div>
            ) : (
              <p className="quiet">No validation result yet.</p>
            )}
          </div>
          <div className="content-band">
            <div className="band-heading">
              <h2>Deployment targets</h2>
              <span>{targets.length}</span>
            </div>
            <div className="target-form">
              <label>
                Name
                <input
                  value={targetName}
                  onChange={(event) => setTargetName(event.target.value)}
                />
              </label>
              <label>
                Environment
                <select
                  value={environment}
                  onChange={(event) =>
                    setEnvironment(event.target.value as DeploymentEnvironment)
                  }
                >
                  <option value="development">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </label>
              <label className="kubeconfig-field">
                Kubeconfig
                <input
                  key={kubeconfigInputKey}
                  type="file"
                  accept=".yaml,.yml,application/yaml,text/yaml"
                  onChange={(event) =>
                    void chooseKubeconfig(event.target.files?.[0])
                  }
                />
                <small>{kubeconfigFileName || "No file selected"}</small>
              </label>
              {deploymentCapabilities?.executionEnabled && (
                <label className="checkbox-field credential-retention-field">
                  <input
                    type="checkbox"
                    checked={retainCredential}
                    disabled={!connectionInspection}
                    onChange={(event) =>
                      setRetainCredential(event.target.checked)
                    }
                  />
                  Store encrypted credential
                </label>
              )}
              <div className="target-form-actions">
                <button
                  className="secondary-button"
                  disabled={!kubeconfig || busy === "connection-inspect"}
                  onClick={() => void inspectConnection()}
                >
                  {busy === "connection-inspect" ? "Inspecting..." : "Inspect"}
                </button>
                <button
                  className="primary-button"
                  disabled={
                    busy === "target" ||
                    (Boolean(kubeconfig) && !connectionInspection)
                  }
                  onClick={() => void createTarget()}
                >
                  {busy === "target"
                    ? "Adding..."
                    : kubeconfig
                      ? "Add inspected target"
                      : "Add draft target"}
                </button>
              </div>
            </div>
            {connectionInspection && (
              <div className="connection-summary" aria-live="polite">
                <div>
                  <span>Context</span>
                  <strong>{connectionInspection.connection.context}</strong>
                </div>
                <div>
                  <span>API server</span>
                  <strong>{connectionInspection.connection.serverHost}</strong>
                </div>
                <div>
                  <span>Namespace</span>
                  <strong>{connectionInspection.connection.namespace}</strong>
                </div>
                <div>
                  <span>Authentication</span>
                  <strong>
                    {connectionInspection.connection.credentialMechanism}
                  </strong>
                </div>
                {connectionInspection.warnings.map((warning) => (
                  <p className="connection-warning" key={warning}>
                    {warning}
                  </p>
                ))}
              </div>
            )}
            <div className="target-list">
              {targets.length === 0 && (
                <p className="quiet">No deployment targets.</p>
              )}
              {targets.map((target) => (
                <div key={target.id}>
                  <span className={`environment ${target.environment}`}>
                    {target.environment}
                  </span>
                  <span className="target-identity">
                    <strong>{target.name}</strong>
                    <small>
                      {target.config.connectionStatus !== "draft"
                        ? target.config.connection.serverHost
                        : target.type}
                    </small>
                  </span>
                  <span
                    className={`connection-status ${target.config.connectionStatus}`}
                  >
                    {target.config.connectionStatus}
                  </span>
                  <span className="target-row-actions">
                    {deploymentCapabilities?.executionEnabled &&
                      target.config.connectionStatus === "inspected" && (
                        <button
                          className="small-button"
                          disabled={
                            !connectionInspection ||
                            busy === `connect-${target.id}`
                          }
                          onClick={() => void connectTarget(target)}
                        >
                          {busy === `connect-${target.id}`
                            ? "Connecting..."
                            : "Connect"}
                        </button>
                      )}
                    {target.config.connectionStatus === "connected" && (
                      <button
                        className="small-button"
                        disabled={busy === `revoke-${target.id}`}
                        onClick={() => void revokeTarget(target)}
                      >
                        {busy === `revoke-${target.id}`
                          ? "Revoking..."
                          : "Revoke"}
                      </button>
                    )}
                    <button
                      className="small-button"
                      disabled={
                        !artifact ||
                        target.config.connectionStatus === "draft" ||
                        busy === `plan-${target.id}`
                      }
                      onClick={() => void buildPlan(target)}
                    >
                      {busy === `plan-${target.id}`
                        ? "Planning..."
                        : "Build plan"}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="content-band deployment-plan-band">
            <div className="band-heading">
              <h2>Deployment preflight</h2>
              <span>{deploymentPlan?.resources.length ?? 0} resources</span>
            </div>
            {deploymentPlan ? (
              <>
                <div className="plan-summary">
                  <div>
                    <span>Mode</span>
                    <strong>Offline preflight</strong>
                  </div>
                  <div>
                    <span>Context</span>
                    <strong>{deploymentPlan.connection.context}</strong>
                  </div>
                  <div>
                    <span>Namespace</span>
                    <strong>{deploymentPlan.connection.namespace}</strong>
                  </div>
                  <div>
                    <span>Execution</span>
                    <strong>Approval required</strong>
                  </div>
                </div>
                <div className="plan-resource-table">
                  <div className="plan-resource-row plan-resource-head">
                    <span>Order</span>
                    <span>Resource</span>
                    <span>Namespace</span>
                    <span>Action</span>
                  </div>
                  {deploymentPlan.resources.map((resource) => (
                    <div
                      className="plan-resource-row"
                      key={`${resource.apiVersion}/${resource.kind}/${resource.namespace ?? "cluster"}/${resource.name}`}
                    >
                      <span>{resource.order}</span>
                      <span>
                        <strong>
                          {resource.kind}/{resource.name}
                        </strong>
                        <small>{resource.sourcePath}</small>
                      </span>
                      <span>{resource.namespace ?? "cluster"}</span>
                      <span>{resource.action}</span>
                    </div>
                  ))}
                </div>
                <div className="plan-warnings">
                  {deploymentPlan.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
                {deploymentCapabilities?.executionEnabled &&
                  plannedTarget?.config.connectionStatus === "connected" && (
                    <div className="deployment-approval-bar">
                      <label className="checkbox-field">
                        <input
                          type="checkbox"
                          checked={deploymentConfirmed}
                          disabled={Boolean(deploymentApproval)}
                          onChange={(event) =>
                            setDeploymentConfirmed(event.target.checked)
                          }
                        />
                        Approve exact artifact
                      </label>
                      {deploymentApproval ? (
                        <>
                          <span>
                            Expires{" "}
                            {new Date(
                              deploymentApproval.expiresAt,
                            ).toLocaleTimeString()}
                          </span>
                          <button
                            className="primary-button"
                            disabled={busy === "deployment-execute"}
                            onClick={() => void executeDeployment()}
                          >
                            {busy === "deployment-execute"
                              ? "Deploying..."
                              : "Deploy"}
                          </button>
                        </>
                      ) : (
                        <button
                          className="secondary-button"
                          disabled={
                            !deploymentConfirmed ||
                            busy === "deployment-approve"
                          }
                          onClick={() => void approveDeployment()}
                        >
                          {busy === "deployment-approve"
                            ? "Approving..."
                            : "Approve plan"}
                        </button>
                      )}
                    </div>
                  )}
              </>
            ) : (
              <p className="quiet">No deployment plan.</p>
            )}
          </div>
          <div className="content-band deployment-operations-band">
            <div className="band-heading">
              <h2>Deployment operations</h2>
              <span>{deploymentOperations.length}</span>
            </div>
            {shownDeployment ? (
              <>
                <div className="operation-summary">
                  <div>
                    <span>Action</span>
                    <strong>{shownDeployment.kind}</strong>
                  </div>
                  <div>
                    <span>Operation</span>
                    <strong>{shownDeployment.status}</strong>
                  </div>
                  <div>
                    <span>Rollout</span>
                    <strong>{shownDeployment.rolloutStatus}</strong>
                  </div>
                  <div>
                    <span>Updated</span>
                    <strong>
                      {new Date(shownDeployment.updatedAt).toLocaleTimeString()}
                    </strong>
                  </div>
                </div>
                <div className="operation-actions">
                  <button
                    className="secondary-button"
                    disabled={
                      !deploymentCapabilities?.executionEnabled ||
                      busy === `deployment-refresh-${shownDeployment.id}`
                    }
                    onClick={() => void refreshDeployment(shownDeployment)}
                  >
                    {busy === `deployment-refresh-${shownDeployment.id}`
                      ? "Refreshing..."
                      : "Refresh status"}
                  </button>
                  {shownDeployment.rollbackAvailable &&
                    (rollbackApproval?.sourceOperationId ===
                    shownDeployment.id ? (
                      <button
                        className="danger-button"
                        disabled={busy === "rollback-execute"}
                        onClick={() => void executeRollback()}
                      >
                        {busy === "rollback-execute"
                          ? "Rolling back..."
                          : "Roll back"}
                      </button>
                    ) : (
                      <button
                        className="secondary-button"
                        disabled={
                          busy === `rollback-approve-${shownDeployment.id}`
                        }
                        onClick={() => void approveRollback(shownDeployment)}
                      >
                        {busy === `rollback-approve-${shownDeployment.id}`
                          ? "Approving..."
                          : "Approve rollback"}
                      </button>
                    ))}
                </div>
                {(shownDeployment.errorCode ||
                  shownDeployment.errorMessage) && (
                  <p className="form-error" role="status">
                    {shownDeployment.errorCode}: {shownDeployment.errorMessage}
                  </p>
                )}
                <div className="plan-resource-table operation-resource-table">
                  <div className="plan-resource-row operation-resource-row plan-resource-head">
                    <span>Order</span>
                    <span>Resource</span>
                    <span>Action</span>
                    <span>Status</span>
                  </div>
                  {shownDeployment.resources.map((resource) => (
                    <div
                      className="plan-resource-row operation-resource-row"
                      key={`${resource.action}/${resource.apiVersion}/${resource.kind}/${resource.namespace ?? "cluster"}/${resource.name}`}
                    >
                      <span>{resource.order}</span>
                      <span>
                        <strong>
                          {resource.kind}/{resource.name}
                        </strong>
                        <small>{resource.namespace ?? "cluster"}</small>
                      </span>
                      <span>{resource.action}</span>
                      <span className={`resource-state ${resource.status}`}>
                        {resource.status}
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  className="operation-history"
                  aria-label="Operation history"
                >
                  {deploymentOperations.map((operation) => (
                    <button
                      className={
                        shownDeployment.id === operation.id ? "active" : ""
                      }
                      key={operation.id}
                      onClick={() => {
                        setActiveDeployment(operation);
                        setRollbackApproval(undefined);
                      }}
                    >
                      <span>{operation.kind}</span>
                      <strong>{operation.status}</strong>
                      <time>
                        {new Date(operation.createdAt).toLocaleString()}
                      </time>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="quiet">No deployment operations.</p>
            )}
          </div>
        </section>
      )}
    </>
  );
}
