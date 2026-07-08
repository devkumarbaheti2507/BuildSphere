import type {
  GeneratedFile,
  ProjectSummary,
  ToolSelection,
} from "@buildsphere/shared-types";
import type { SuggestionDraft } from "./repository.js";

export interface AnalysisInput {
  architectureType?: ProjectSummary["architectureType"];
  visibility?: ProjectSummary["visibility"];
  toolSelections: ToolSelection[];
  files: GeneratedFile[];
}

type Rule = (input: AnalysisInput) => SuggestionDraft | undefined;
const file = (input: AnalysisInput, pathPart: string) =>
  input.files.find((candidate) => candidate.path.includes(pathPart))?.content;
const hasTool = (input: AnalysisInput, toolKey: string) =>
  input.toolSelections.some((selection) => selection.toolKey === toolKey);

export const rules: Rule[] = [
  (input) =>
    !file(input, "Dockerfile")
      ? {
          projectId: "",
          category: "docker",
          severity: "high",
          confidence: 0.99,
          title: "Add a container build",
          description:
            "No Dockerfile was found, so the application cannot be packaged consistently.",
          recommendedAction: "Generate and review a multi-stage Dockerfile.",
        }
      : undefined,
  (input) =>
    /FROM\s+[^\s:]+:latest/i.test(file(input, "Dockerfile") ?? "")
      ? {
          projectId: "",
          category: "docker",
          severity: "medium",
          confidence: 0.98,
          title: "Pin the Docker base image",
          description:
            "The latest tag can change without a source-code change and make builds unpredictable.",
          recommendedAction: "Use a tested major or digest-pinned base image.",
        }
      : undefined,
  (input) =>
    file(input, "Dockerfile") && !/\sAS\s+/i.test(file(input, "Dockerfile")!)
      ? {
          projectId: "",
          category: "docker",
          severity: "medium",
          confidence: 0.9,
          title: "Use a multi-stage Docker build",
          description:
            "Build dependencies appear to remain in the runtime image.",
          recommendedAction:
            "Compile in a builder stage and copy only runtime output into the final stage.",
        }
      : undefined,
  (input) =>
    hasTool(input, "kubernetes") && !file(input, "deployment.yaml")
      ? {
          projectId: "",
          category: "kubernetes",
          severity: "high",
          confidence: 0.99,
          title: "Generate a Kubernetes deployment",
          description:
            "Kubernetes is selected but no deployment manifest was found.",
          recommendedAction:
            "Generate deployment, service, namespace, and ingress manifests.",
        }
      : undefined,
  (input) =>
    file(input, "deployment.yaml") &&
    !file(input, "deployment.yaml")!.includes("readinessProbe")
      ? {
          projectId: "",
          category: "kubernetes",
          severity: "high",
          confidence: 0.98,
          title: "Add a readiness probe",
          description:
            "Kubernetes may send traffic before the application is ready.",
          recommendedAction:
            "Configure a readiness probe against the health endpoint.",
        }
      : undefined,
  (input) =>
    file(input, "deployment.yaml") &&
    !file(input, "deployment.yaml")!.includes("livenessProbe")
      ? {
          projectId: "",
          category: "kubernetes",
          severity: "medium",
          confidence: 0.98,
          title: "Add a liveness probe",
          description:
            "Kubernetes cannot detect and restart a stuck application process.",
          recommendedAction:
            "Configure a conservative liveness probe against the health endpoint.",
        }
      : undefined,
  (input) =>
    file(input, "deployment.yaml") &&
    !file(input, "deployment.yaml")!.includes("resources:")
      ? {
          projectId: "",
          category: "kubernetes",
          severity: "medium",
          confidence: 0.94,
          title: "Set container resource boundaries",
          description:
            "A pod without requests and limits can be scheduled or throttled unpredictably.",
          recommendedAction: "Add tested CPU and memory requests and limits.",
        }
      : undefined,
  (input) =>
    !input.files.some((candidate) => /test|spec/i.test(candidate.path))
      ? {
          projectId: "",
          category: "testing",
          severity: "medium",
          confidence: 0.88,
          title: "Add an automated test suite",
          description:
            "No generated test files were found, leaving the pipeline with little regression protection.",
          recommendedAction:
            "Add unit tests for business logic and API tests for core endpoints.",
        }
      : undefined,
  (input) =>
    hasTool(input, "github-actions") && !file(input, ".github/workflows")
      ? {
          projectId: "",
          category: "cicd",
          severity: "high",
          confidence: 0.99,
          title: "Generate the selected CI workflow",
          description:
            "GitHub Actions is selected but no workflow file was found.",
          recommendedAction:
            "Generate a workflow that installs, tests, builds, and packages the application.",
        }
      : undefined,
  (input) =>
    (file(input, ".github/workflows") ?? "").includes("--frozen-lockfile=false")
      ? {
          projectId: "",
          category: "cicd",
          severity: "medium",
          confidence: 0.97,
          title: "Freeze dependencies in CI",
          description:
            "Allowing lockfile updates in CI can make a build differ from the reviewed commit.",
          recommendedAction:
            "Use pnpm install --frozen-lockfile after committing an up-to-date lockfile.",
        }
      : undefined,
  (input) =>
    input.architectureType === "microservices" && !hasTool(input, "redis")
      ? {
          projectId: "",
          category: "architecture",
          severity: "low",
          confidence: 0.72,
          title: "Review cross-service caching needs",
          description:
            "The microservice configuration has no shared cache or ephemeral coordination layer.",
          recommendedAction:
            "Add Redis only where caching, locks, or lightweight queues have a measured benefit.",
        }
      : undefined,
  (input) =>
    !hasTool(input, "prometheus")
      ? {
          projectId: "",
          category: "observability",
          severity: "medium",
          confidence: 0.91,
          title: "Add service metrics",
          description:
            "No monitoring tool is selected, so failures may only be visible after users report them.",
          recommendedAction:
            "Expose Prometheus-compatible metrics and monitor health, latency, and error rate.",
        }
      : undefined,
  (input) =>
    input.visibility === "public"
      ? {
          projectId: "",
          category: "security",
          severity: "medium",
          confidence: 0.85,
          title: "Review public project contents",
          description:
            "Public project metadata and generated assets require extra secret and privacy review.",
          recommendedAction:
            "Scan generated files for credentials and remove private infrastructure details before sharing.",
        }
      : undefined,
];

export const analyzeWithRules = (
  projectId: string,
  input: AnalysisInput,
): SuggestionDraft[] =>
  rules.flatMap((rule) => {
    const suggestion = rule(input);
    return suggestion ? [{ ...suggestion, projectId }] : [];
  });
