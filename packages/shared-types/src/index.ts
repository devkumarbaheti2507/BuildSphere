export type UserRole = "user" | "admin";

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSession extends AuthTokens {
  user: UserSummary;
}

export interface AuthProviderAvailability {
  github: {
    enabled: boolean;
  };
}

export interface GitHubAuthorization {
  authorizationUrl: string;
  expiresAt: string;
}

export interface GitHubRepositorySummary {
  projectId: string;
  githubRepositoryId: string;
  ownerLogin: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  publishedFiles: number;
  lastPublishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublishGitHubRepositoryInput {
  name: string;
  description?: string;
  private: boolean;
  artifactId?: string;
}

export interface GitHubWorkflowRun {
  githubRunId: string;
  projectId: string;
  name: string;
  status: PipelineExecutionStatus;
  conclusion?: string;
  branch?: string;
  headSha: string;
  runNumber: number;
  event: string;
  htmlUrl: string;
  startedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
}

export interface ApiSuccess<
  T,
  M extends Record<string, unknown> = Record<string, never>,
> {
  data: T;
  meta: M;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

export type ArchitectureType = "monolith" | "microservices";
export type ProjectVisibility = "private" | "public";
export type ProjectStatus = "active" | "archived";

export type ToolCategory =
  | "frontend"
  | "backend"
  | "database"
  | "cache"
  | "ci"
  | "container"
  | "deployment"
  | "monitoring"
  | "packaging"
  | "infrastructure";

export type SupportedToolKey =
  | "react"
  | "nodejs"
  | "postgresql"
  | "redis"
  | "github-actions"
  | "docker"
  | "kubernetes"
  | "prometheus"
  | "helm"
  | "terraform-aws-eks";

export interface ToolSelection {
  category: ToolCategory;
  toolKey: SupportedToolKey;
  config: Record<string, unknown>;
}

export interface ProjectSummary {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  architectureType: ArchitectureType;
  visibility: ProjectVisibility;
  status: ProjectStatus;
  toolSelections: ToolSelection[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  architectureType: ArchitectureType;
  visibility: ProjectVisibility;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  visibility?: ProjectVisibility;
  status?: ProjectStatus;
}

export type TemplateCategory =
  | "frontend"
  | "backend"
  | "docker"
  | "github-actions"
  | "kubernetes"
  | "helm"
  | "terraform";

export interface TemplateMetadata {
  key: string;
  category: TemplateCategory;
  displayName: string;
  description: string;
  supportedVariables: string[];
  outputPath: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  explanation: string;
}

export interface GeneratedArtifact {
  id: string;
  projectId: string;
  artifactType: "bundle";
  files: GeneratedFile[];
  checksum: string;
  createdAt: string;
}

export interface GenerationVariables {
  projectName: string;
  serviceName: string;
  containerPort: number;
  imageName: string;
  imageTag: string;
  namespace: string;
  replicas: number;
  host: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  awsRegion: string;
  environment: string;
}

export type PipelineExecutionStatus =
  "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type PipelineStageStatus =
  "pending" | "running" | "succeeded" | "failed" | "skipped";

export interface LearningExplanation {
  what: string;
  why: string;
  commonFailures: string[];
  fixes: string[];
}

export interface PipelineStage {
  key: string;
  name: string;
  description: string;
  order: number;
  explanation: LearningExplanation;
}

export interface PipelineDefinition {
  id: string;
  projectId: string;
  name: string;
  provider: "github-actions" | "simulated";
  stages: PipelineStage[];
  createdAt: string;
}

export interface PipelineExecutionStage {
  key: string;
  status: PipelineStageStatus;
  startedAt?: string;
  finishedAt?: string;
}

export interface PipelineExecutionSummary {
  id: string;
  pipelineId: string;
  status: PipelineExecutionStatus;
  stages: PipelineExecutionStage[];
  triggerType: "manual" | "git_push" | "scheduled";
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

export type LogLevel = "info" | "warn" | "error";

export interface PipelineLog {
  id: string;
  executionId: string;
  stageKey: string;
  level: LogLevel;
  message: string;
  timestamp: string;
}

export type SuggestionCategory =
  | "architecture"
  | "docker"
  | "kubernetes"
  | "security"
  | "testing"
  | "cicd"
  | "observability";
export type SuggestionSeverity = "low" | "medium" | "high" | "critical";
export type SuggestionStatus = "open" | "accepted" | "dismissed";

export interface Suggestion {
  id: string;
  projectId: string;
  category: SuggestionCategory;
  severity: SuggestionSeverity;
  title: string;
  description: string;
  recommendedAction: string;
  confidence: number;
  status: SuggestionStatus;
  createdAt: string;
}

export type DeploymentEnvironment = "development" | "staging" | "production";

export type KubernetesCredentialMechanism =
  "token" | "client-certificate" | "exec" | "auth-provider" | "basic" | "none";

export interface KubernetesConnectionSummary {
  context: string;
  cluster: string;
  serverHost: string;
  namespace: string;
  credentialMechanism: KubernetesCredentialMechanism;
  tlsVerification: "enabled" | "disabled";
  contextCount: number;
}

export interface KubernetesConnectionInspection {
  valid: true;
  connection: KubernetesConnectionSummary;
  warnings: string[];
  clusterRequestMade: false;
}

export type KubernetesTargetConfig =
  | { connectionStatus: "draft" }
  | {
      connectionStatus: "inspected";
      connection: KubernetesConnectionSummary;
    }
  | {
      connectionStatus: "connected";
      connection: KubernetesConnectionSummary;
      credentialStoredAt: string;
    };

export interface DeploymentTarget {
  id: string;
  projectId: string;
  name: string;
  type: "kubernetes";
  environment: DeploymentEnvironment;
  config: KubernetesTargetConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface KubernetesDeploymentPlanResource {
  order: number;
  sourcePath: string;
  documentIndex: number;
  apiVersion: string;
  kind: string;
  name: string;
  namespace?: string;
  scope: "cluster" | "namespace";
  action: "apply";
}

export interface KubernetesDeploymentPlan {
  targetId: string;
  projectId: string;
  environment: DeploymentEnvironment;
  mode: "offline-preflight";
  executable: false;
  clusterRequestMade: false;
  connection: KubernetesConnectionSummary;
  resources: KubernetesDeploymentPlanResource[];
  warnings: string[];
  createdAt: string;
}

export interface KubernetesExecutionCapabilities {
  executionEnabled: boolean;
  allowedEnvironments: DeploymentEnvironment[];
  approvalTtlSeconds: number;
  requestTimeoutMs: number;
  operationTimeoutMs: number;
  maxAttempts: number;
  supportedKinds: string[];
}

export type KubernetesDeploymentAction = "apply" | "rollback";
export type KubernetesApprovalStatus =
  "pending" | "consumed" | "expired" | "revoked";

export interface KubernetesDeploymentApproval {
  id: string;
  targetId: string;
  projectId: string;
  artifactId: string;
  action: KubernetesDeploymentAction;
  sourceOperationId?: string;
  manifestDigest: string;
  status: KubernetesApprovalStatus;
  expiresAt: string;
  consumedAt?: string;
  createdAt: string;
}

export type KubernetesDeploymentOperationStatus =
  | "queued"
  | "applying"
  | "succeeded"
  | "failed"
  | "rolling_back"
  | "rolled_back"
  | "rollback_failed";

export type KubernetesRolloutStatus =
  "unknown" | "progressing" | "healthy" | "degraded";

export type KubernetesOperationResourceStatus =
  | "pending"
  | "applied"
  | "retained"
  | "present"
  | "progressing"
  | "ready"
  | "degraded"
  | "missing"
  | "deleted"
  | "failed";

export interface KubernetesOperationResource {
  order: number;
  apiVersion: string;
  kind: string;
  name: string;
  namespace?: string;
  scope: "cluster" | "namespace";
  action: "apply" | "delete";
  status: KubernetesOperationResourceStatus;
  attempts: number;
  message?: string;
  observedAt?: string;
}

export interface KubernetesDeploymentOperation {
  id: string;
  targetId: string;
  projectId: string;
  artifactId: string;
  approvalId: string;
  kind: KubernetesDeploymentAction;
  status: KubernetesDeploymentOperationStatus;
  rolloutStatus: KubernetesRolloutStatus;
  manifestDigest: string;
  resources: KubernetesOperationResource[];
  rollbackOfId?: string;
  restoredOperationId?: string;
  rollbackAvailable: boolean;
  errorCode?: string;
  errorMessage?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | "project.created"
  | "pipeline.generated"
  | "pipeline.execution.started"
  | "pipeline.execution.failed"
  | "suggestion.created"
  | "deployment.succeeded"
  | "deployment.failed"
  | "deployment.rolled_back";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}

export interface ServiceHealth {
  service: string;
  status: "ok" | "unavailable";
  timestamp: string;
  responseTimeMs?: number;
}

export interface PlatformHealth {
  status: "ok" | "degraded";
  services: ServiceHealth[];
  checkedAt: string;
}
