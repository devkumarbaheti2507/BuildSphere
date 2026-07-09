CREATE TABLE project_github_repositories (
  project_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_repository_id bigint NOT NULL UNIQUE,
  owner_login text NOT NULL,
  name text NOT NULL,
  full_name text NOT NULL UNIQUE,
  private boolean NOT NULL,
  default_branch text NOT NULL,
  html_url text NOT NULL,
  published_files integer NOT NULL DEFAULT 0 CHECK (published_files >= 0),
  last_published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_github_repositories_user_id_idx
  ON project_github_repositories(user_id);

CREATE TABLE github_workflow_runs (
  github_run_id bigint PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES project_github_repositories(project_id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  conclusion text,
  branch text,
  head_sha text NOT NULL,
  run_number integer NOT NULL,
  event text NOT NULL,
  html_url text NOT NULL,
  started_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX github_workflow_runs_project_created_idx
  ON github_workflow_runs(project_id, created_at DESC);
