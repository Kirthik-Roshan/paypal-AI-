CREATE TABLE paypal_invoices (
  agreement_id TEXT PRIMARY KEY REFERENCES agreements(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  request_id TEXT NOT NULL REFERENCES requests(id),
  invoice_number TEXT NOT NULL UNIQUE,
  provider_id TEXT,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL,
  snapshot TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
