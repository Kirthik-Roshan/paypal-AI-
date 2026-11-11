-- rebuild-parent: foreign keys are temporarily disabled by the migration runner.
CREATE TABLE workspaces_new (id TEXT PRIMARY KEY, name TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('local','sample','sandbox')), timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata', created_at TEXT NOT NULL, owner_id TEXT);
INSERT INTO workspaces_new (id,name,mode,timezone,created_at,owner_id) SELECT id,name,mode,timezone,created_at,NULL FROM workspaces;
DROP TABLE workspaces;
ALTER TABLE workspaces_new RENAME TO workspaces;
CREATE UNIQUE INDEX workspace_owner ON workspaces(owner_id) WHERE owner_id IS NOT NULL;
