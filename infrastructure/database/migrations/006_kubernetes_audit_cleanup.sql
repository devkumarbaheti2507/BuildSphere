ALTER TABLE deployment_operations
  DROP CONSTRAINT deployment_operations_approval_id_fkey,
  ADD CONSTRAINT deployment_operations_approval_id_fkey
    FOREIGN KEY (approval_id) REFERENCES deployment_approvals(id) ON DELETE CASCADE;

ALTER TABLE deployment_approvals
  DROP CONSTRAINT deployment_approvals_source_operation_fk,
  ADD CONSTRAINT deployment_approvals_source_operation_fk
    FOREIGN KEY (source_operation_id) REFERENCES deployment_operations(id) ON DELETE CASCADE;
