ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE github_connections (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  github_user_id text NOT NULL UNIQUE,
  login text NOT NULL,
  avatar_url text,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX github_connections_login_idx ON github_connections(login);
