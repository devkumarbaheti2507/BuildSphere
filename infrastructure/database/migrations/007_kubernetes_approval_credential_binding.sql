ALTER TABLE deployment_approvals
  ADD COLUMN credential_fingerprint text;

UPDATE deployment_approvals approval
SET credential_fingerprint = credential.fingerprint
FROM deployment_target_credentials credential
WHERE credential.target_id = approval.target_id;

UPDATE deployment_approvals
SET credential_fingerprint = repeat('0', 64)
WHERE credential_fingerprint IS NULL;

ALTER TABLE deployment_approvals
  ALTER COLUMN credential_fingerprint SET NOT NULL,
  ADD CONSTRAINT deployment_approvals_credential_fingerprint_check
    CHECK (length(credential_fingerprint) = 64);

ALTER TABLE deployment_operations
  ADD COLUMN credential_fingerprint text;

UPDATE deployment_operations operation
SET credential_fingerprint = approval.credential_fingerprint
FROM deployment_approvals approval
WHERE approval.id = operation.approval_id;

ALTER TABLE deployment_operations
  ALTER COLUMN credential_fingerprint SET NOT NULL,
  ADD CONSTRAINT deployment_operations_credential_fingerprint_check
    CHECK (length(credential_fingerprint) = 64);
