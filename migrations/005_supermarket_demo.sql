CREATE TABLE demo_sessions (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id),
  request_id TEXT NOT NULL REFERENCES requests(id),
  config TEXT NOT NULL,
  messages TEXT NOT NULL,
  confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX one_call_per_supplier_stage ON calls(workspace_id,request_id,supplier_id) WHERE status != 'failed';
