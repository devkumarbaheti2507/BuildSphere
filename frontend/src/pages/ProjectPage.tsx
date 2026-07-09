import { useEffect, useState } from "react";
import type {
  DeploymentEnvironment,
  DeploymentTarget,
  GeneratedArtifact,
  GeneratedFile,
  GitHubRepositorySummary,
  GitHubWorkflowRun,
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
  | "overview"
  | "files"
  | "pipeline"
  | "github"
  | "suggestions"
  | "deployment";
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
  const [targetName, setTargetName] = useState("Local cluster");
  const [environment, setEnvironment] =
    useState<DeploymentEnvironment>("development");
  const [repositoryName, setRepositoryName] = useState("");
  const [repositoryPrivate, setRepositoryPrivate] = useState(true);
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
      ] = await Promise.all([
        api.project(token, projectId),
        api.artifacts(token, projectId),
        api.pipelines(token, projectId),
        api.suggestions(token, projectId),
        api.targets(token, projectId),
      ]);
      setProject(nextProject);
      setArtifacts(nextArtifacts);
      setPipelines(nextPipelines);
      setSuggestions(nextSuggestions);
      setTargets(nextTargets);
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
          linked
            ? await api.githubRuns(token, projectId).catch(() => [])
            : [],
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
    try {
      await api.createTarget(token, projectId, targetName, environment);
      setTargets(await api.targets(token, projectId));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Target creation failed",
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
              <p>The provider becomes available after the GitHub App settings are configured.</p>
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
                      onChange={(event) => setRepositoryName(event.target.value)}
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
                      !artifact ||
                      !repositoryName ||
                      busy === "github-publish"
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
                    {busy === "github-sync" ? "Synchronizing..." : "Synchronize"}
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
            <div className="inline-form">
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
              <button
                className="primary-button"
                disabled={busy === "target"}
                onClick={createTarget}
              >
                Add target
              </button>
            </div>
            <div className="target-list">
              {targets.map((target) => (
                <div key={target.id}>
                  <span className={`environment ${target.environment}`}>
                    {target.environment}
                  </span>
                  <strong>{target.name}</strong>
                  <small>{target.type}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
