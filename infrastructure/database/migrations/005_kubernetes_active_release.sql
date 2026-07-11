ALTER TABLE deployment_operations
  ADD COLUMN restored_operation_id uuid REFERENCES deployment_operations(id);

ALTER TABLE deployment_operations
  ADD CONSTRAINT deployment_operations_restored_release_check
  CHECK (
    (kind = 'apply' AND restored_operation_id IS NULL) OR
    (kind = 'rollback' AND restored_operation_id IS NOT NULL)
  );

CREATE INDEX deployment_operations_restored_operation_idx
  ON deployment_operations(restored_operation_id)
  WHERE restored_operation_id IS NOT NULL;
