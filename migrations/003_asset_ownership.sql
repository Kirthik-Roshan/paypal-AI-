ALTER TABLE assets ADD COLUMN supplier_id TEXT REFERENCES suppliers(id);
