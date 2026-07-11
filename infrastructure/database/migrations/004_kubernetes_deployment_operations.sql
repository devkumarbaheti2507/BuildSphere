CREATE TABLE deployment_target_credentials (
  target_id uuid PRIMARY KEY REFERENCES deployment_targets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  kubeconfig_encrypted text NOT NULL,
  key_version text NOT NULL CHECK (key_version IN ('v1')) DEFAULT 'v1',
  fingerprint text NOT NULL CHECK (length(fingerprint) = 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deployment_target_credentials_owner_idx
  ON deployment_target_credentials(owner_id, target_id);

CREATE TABLE deployment_approvals (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  target_id uuid NOT NULL REFERENCES deployment_targets(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  artifact_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('apply', 'rollback')),
  source_operation_id uuid,
  manifest_digest text NOT NULL CHECK (length(manifest_digest) = 64),
  status text NOT NULL CHECK (status IN ('pending', 'consumed', 'expired', 'revoked')) DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (action = 'apply' AND source_operation_id IS NULL) OR
    (action = 'rollback' AND source_operation_id IS NOT NULL)
  )
);

CREATE INDEX deployment_approvals_owner_target_idx
  ON deployment_approvals(owner_id, target_id, created_at DESC);

CREATE TABLE deployment_operations (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  target_id uuid NOT NULL REFERENCES deployment_targets(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  artifact_id uuid NOT NULL,
  approval_id uuid NOT NULL UNIQUE REFERENCES deployment_approvals(id),
  kind text NOT NULL CHECK (kind IN ('apply', 'rollback')),
  status text NOT NULL CHECK (
    status IN (
      'queued',
      'applying',
      'succeeded',
      'failed',
      'rolling_back',
      'rolled_back',
      'rollback_failed'
    )
  ) DEFAULT 'queued',
  rollout_status text NOT NULL CHECK (
    rollout_status IN ('unknown', 'progressing', 'healthy', 'degraded')
  ) DEFAULT 'unknown',
  idempotency_key uuid NOT NULL,
  manifest_digest text NOT NULL CHECK (length(manifest_digest) = 64),
  resources jsonb NOT NULL DEFAULT '[]'::jsonb,
  rollback_of_id uuid REFERENCES deployment_operations(id),
  error_code text,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, idempotency_key),
  CHECK (
    (kind = 'apply' AND rollback_of_id IS NULL) OR
    (kind = 'rollback' AND rollback_of_id IS NOT NULL)
  )
);

ALTER TABLE deployment_approvals
  ADD CONSTRAINT deployment_approvals_source_operation_fk
  FOREIGN KEY (source_operation_id) REFERENCES deployment_operations(id);

CREATE INDEX deployment_operations_owner_project_idx
  ON deployment_operations(owner_id, project_id, created_at DESC);

CREATE INDEX deployment_operations_target_created_idx
  ON deployment_operations(target_id, created_at DESC);

CREATE UNIQUE INDEX deployment_operations_one_active_target_idx
  ON deployment_operations(target_id)
  WHERE status IN ('queued', 'applying', 'rolling_back');
