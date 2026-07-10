import { useState } from "react";
import type {
  ArchitectureType,
  ProjectVisibility,
  ToolSelection,
} from "@buildsphere/shared-types";
import { api, ApiClientError } from "../api";
import { navigate } from "../navigation";

export function CreateProjectPage({ token }: { token: string }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [architectureType, setArchitecture] =
    useState<ArchitectureType>("microservices");
  const [visibility, setVisibility] = useState<ProjectVisibility>("private");
  const [redis, setRedis] = useState(true);
  const [prometheus, setPrometheus] = useState(true);
  const [helm, setHelm] = useState(true);
  const [terraformAwsEks, setTerraformAwsEks] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selections = (): ToolSelection[] => [
    { category: "frontend", toolKey: "react", config: {} },
    { category: "backend", toolKey: "nodejs", config: {} },
    { category: "database", toolKey: "postgresql", config: {} },
    { category: "ci", toolKey: "github-actions", config: {} },
    { category: "container", toolKey: "docker", config: {} },
    { category: "deployment", toolKey: "kubernetes", config: {} },
    ...(helm
      ? [
          {
            category: "packaging",
            toolKey: "helm",
            config: {},
          } as ToolSelection,
        ]
      : []),
    ...(terraformAwsEks
      ? [
          {
            category: "infrastructure",
            toolKey: "terraform-aws-eks",
            config: {},
          } as ToolSelection,
        ]
      : []),
    ...(redis
      ? [{ category: "cache", toolKey: "redis", config: {} } as ToolSelection]
      : []),
    ...(prometheus
      ? [
          {
            category: "monitoring",
            toolKey: "prometheus",
            config: {},
          } as ToolSelection,
        ]
      : []),
  ];
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const project = await api.createProject(token, {
        name,
        description,
        architectureType,
        visibility,
      });
      await api.saveTools(token, project.id, selections());
      navigate(`/projects/${project.id}`);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Project creation failed",
      );
    } finally {
      setBusy(false);
    }
  };
  const steps = ["Basics", "Architecture", "Application", "Delivery", "Review"];
  return (
    <div className="wizard-layout">
      <aside className="wizard-steps">
        <button className="back-link" onClick={() => navigate("/dashboard")}>
          Back to dashboard
        </button>
        <h1>New project</h1>
        {steps.map((label, index) => (
          <div
            key={label}
            className={
              index === step
                ? "wizard-step current"
                : index < step
                  ? "wizard-step complete"
                  : "wizard-step"
            }
          >
            <span>{index + 1}</span>
            {label}
          </div>
        ))}
      </aside>
      <section className="wizard-content">
        {step === 0 && (
          <div className="form-section">
            <p className="section-label">Project basics</p>
            <h2>Name the workspace</h2>
            <label>
              Project name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Order Platform"
                minLength={2}
                required
                autoFocus
              />
            </label>
            <label>
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Services, users, and delivery goal"
              />
            </label>
            <label>
              Visibility
              <select
                value={visibility}
                onChange={(event) =>
                  setVisibility(event.target.value as ProjectVisibility)
                }
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </label>
          </div>
        )}
        {step === 1 && (
          <div className="form-section">
            <p className="section-label">Architecture</p>
            <h2>Choose the application shape</h2>
            <div className="choice-grid">
              <button
                className={
                  architectureType === "microservices"
                    ? "choice selected"
                    : "choice"
                }
                onClick={() => setArchitecture("microservices")}
              >
                <strong>Microservices</strong>
                <span>Independent service boundaries and delivery stages</span>
              </button>
              <button
                className={
                  architectureType === "monolith" ? "choice selected" : "choice"
                }
                onClick={() => setArchitecture("monolith")}
              >
                <strong>Monolith</strong>
                <span>One deployable application with a simpler runtime</span>
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="form-section">
            <p className="section-label">Application stack</p>
            <h2>Runtime components</h2>
            <div className="selection-list">
              <div>
                <span>Frontend</span>
                <strong>React + TypeScript</strong>
              </div>
              <div>
                <span>Backend</span>
                <strong>Node.js + Express</strong>
              </div>
              <div>
                <span>Database</span>
                <strong>PostgreSQL</strong>
              </div>
              <label className="toggle-row">
                <span>
                  <strong>Redis</strong>
                  <small>Cache and ephemeral coordination</small>
                </span>
                <input
                  type="checkbox"
                  checked={redis}
                  onChange={(event) => setRedis(event.target.checked)}
                />
              </label>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="form-section">
            <p className="section-label">Delivery stack</p>
            <h2>Pipeline and deployment</h2>
            <div className="selection-list">
              <div>
                <span>CI/CD</span>
                <strong>GitHub Actions</strong>
              </div>
              <div>
                <span>Container</span>
                <strong>Docker</strong>
              </div>
              <div>
                <span>Deployment</span>
                <strong>Kubernetes manifests</strong>
              </div>
              <label className="toggle-row">
                <span>
                  <strong>Helm chart</strong>
                  <small>Configurable Kubernetes application package</small>
                </span>
                <input
                  type="checkbox"
                  checked={helm}
                  onChange={(event) => setHelm(event.target.checked)}
                />
              </label>
              <label className="toggle-row">
                <span>
                  <strong>Terraform AWS EKS</strong>
                  <small>Disabled-by-default cloud infrastructure source</small>
                </span>
                <input
                  type="checkbox"
                  checked={terraformAwsEks}
                  onChange={(event) => setTerraformAwsEks(event.target.checked)}
                />
              </label>
              <label className="toggle-row">
                <span>
                  <strong>Prometheus</strong>
                  <small>Service health and metrics model</small>
                </span>
                <input
                  type="checkbox"
                  checked={prometheus}
                  onChange={(event) => setPrometheus(event.target.checked)}
                />
              </label>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="form-section">
            <p className="section-label">Review</p>
            <h2>{name || "Untitled project"}</h2>
            <dl className="review-list">
              <div>
                <dt>Architecture</dt>
                <dd>{architectureType}</dd>
              </div>
              <div>
                <dt>Visibility</dt>
                <dd>{visibility}</dd>
              </div>
              <div>
                <dt>Selected tools</dt>
                <dd>
                  {selections()
                    .map((selection) => selection.toolKey)
                    .join(", ")}
                </dd>
              </div>
            </dl>
            {error && <p className="form-error">{error}</p>}
          </div>
        )}
        <footer className="wizard-actions">
          <button
            className="secondary-button"
            disabled={step === 0 || busy}
            onClick={() => setStep(step - 1)}
          >
            Previous
          </button>
          {step < steps.length - 1 ? (
            <button
              className="primary-button"
              disabled={step === 0 && name.trim().length < 2}
              onClick={() => setStep(step + 1)}
            >
              Continue
            </button>
          ) : (
            <button
              className="primary-button"
              disabled={busy || name.trim().length < 2}
              onClick={submit}
            >
              {busy ? "Creating..." : "Create project"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
