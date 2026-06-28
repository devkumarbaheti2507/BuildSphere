export type UserRole = 'user' | 'admin';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type ArchitectureType = 'monolith' | 'microservices';
export type ProjectVisibility = 'private' | 'public';
export type ProjectStatus = 'active' | 'archived';

export interface ProjectSummary {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  architectureType: ArchitectureType;
  visibility: ProjectVisibility;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export type PipelineExecutionStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type PipelineStageStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface PipelineStage {
  key: string;
  name: string;
  description: string;
  status?: PipelineStageStatus;
}

export interface PipelineExecutionSummary {
  id: string;
  pipelineId: string;
  status: PipelineExecutionStatus;
  startedAt?: string;
  finishedAt?: string;
}

export type SuggestionSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Suggestion {
  id: string;
  projectId: string;
  category: string;
  severity: SuggestionSeverity;
  title: string;
  description: string;
  recommendedAction: string;
  confidence?: number;
  status: 'open' | 'accepted' | 'dismissed';
}
