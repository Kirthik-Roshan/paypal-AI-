DROP INDEX one_call_per_supplier_stage;
CREATE UNIQUE INDEX one_call_per_supplier_stage ON calls(workspace_id,request_id,supplier_id)
WHERE status NOT IN ('failed', 'completed');
