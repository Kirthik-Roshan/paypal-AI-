CREATE TABLE IF NOT EXISTS demo_payment_contacts (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 request_id TEXT NOT NULL REFERENCES requests(id),
 supplier_id TEXT NOT NULL REFERENCES suppliers(id),
 account TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(request_id,supplier_id)
);
