CREATE TABLE users (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'admin')) DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens(user_id);

CREATE TABLE projects (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  architecture_type text NOT NULL CHECK (architecture_type IN ('monolith', 'microservices')),
  visibility text NOT NULL CHECK (visibility IN ('private', 'public')),
  status text NOT NULL CHECK (status IN ('active', 'archived')) DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);

CREATE INDEX projects_owner_id_idx ON projects(owner_id);

CREATE TABLE project_tool_selections (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category text NOT NULL,
  tool_key text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (project_id, category)
);

CREATE TABLE generated_artifacts (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  artifact_type text NOT NULL DEFAULT 'bundle',
  files jsonb NOT NULL,
  checksum text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX generated_artifacts_project_id_idx ON generated_artifacts(project_id);

CREATE TABLE pipeline_definitions (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  project_id uuid NOT NULL,
  name text NOT NULL,
  provider text NOT NULL,
  stages jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pipeline_definitions_project_id_idx ON pipeline_definitions(project_id);

CREATE TABLE pipeline_executions (
  id uuid PRIMARY KEY,
  pipeline_id uuid NOT NULL REFERENCES pipeline_definitions(id) ON DELETE CASCADE,
  status text NOT NULL,
  stages jsonb NOT NULL,
  trigger_type text NOT NULL,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pipeline_executions_pipeline_id_idx ON pipeline_executions(pipeline_id);

CREATE TABLE pipeline_logs (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  execution_id uuid NOT NULL,
  stage_key text NOT NULL,
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pipeline_logs_execution_id_timestamp_idx ON pipeline_logs(owner_id, execution_id, timestamp);

CREATE TABLE suggestions (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  project_id uuid NOT NULL,
  category text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  description text NOT NULL,
  recommended_action text NOT NULL,
  confidence double precision NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'accepted', 'dismissed')) DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX suggestions_project_id_idx ON suggestions(owner_id, project_id);

CREATE TABLE deployment_targets (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  project_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('kubernetes')),
  environment text NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE INDEX deployment_targets_project_id_idx ON deployment_targets(owner_id, project_id);

CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx ON notifications(user_id, read_at, created_at DESC);
