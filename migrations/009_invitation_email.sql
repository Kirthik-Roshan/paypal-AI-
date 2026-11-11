CREATE TABLE invitation_emails (
  invitation_id TEXT PRIMARY KEY REFERENCES invitations(id),
  status TEXT NOT NULL,
  provider_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
