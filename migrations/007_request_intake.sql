CREATE TABLE request_intakes (
 request_id TEXT PRIMARY KEY REFERENCES requests(id),
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 config TEXT NOT NULL,
 messages TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0
);
