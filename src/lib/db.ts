import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Audit } from "./types";

const globalDb = globalThis as unknown as {
  procureDb?: Database.Database;
  intakeSchemaReady?: boolean;
  invoiceSchemaReady?: boolean;
};
export function db() {
  if (globalDb.procureDb && !globalDb.invoiceSchemaReady) {
    if (
      !globalDb.procureDb
        .prepare("SELECT name FROM migrations WHERE name=?")
        .get("010_paypal_invoices.sql")
    ) {
      globalDb.procureDb.close();
      globalDb.procureDb = undefined;
    }
    globalDb.invoiceSchemaReady = true;
  }
  if (globalDb.procureDb && !globalDb.intakeSchemaReady) {
    if (
      !globalDb.procureDb
        .prepare("SELECT name FROM migrations WHERE name=?")
        .get("007_request_intake.sql")
    ) {
      globalDb.procureDb.close();
      globalDb.procureDb = undefined;
    } else globalDb.intakeSchemaReady = true;
  }
  if (!globalDb.procureDb) {
    const filename =
      process.env.DATABASE_PATH ||
      path.join(process.cwd(), "data/procureproof.db");
    mkdirSync(path.dirname(filename), { recursive: true });
    const connection = new Database(filename);
    connection.pragma("journal_mode = WAL");
    connection.pragma("foreign_keys = ON");
    connection.pragma("busy_timeout = 5000");
    connection.exec(
      "CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
    );
    const directory = path.join(process.cwd(), "migrations");
    for (const file of readdirSync(directory)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      if (
        !connection
          .prepare("SELECT name FROM migrations WHERE name = ?")
          .get(file)
      ) {
        const sql = readFileSync(path.join(directory, file), "utf8");
        const rebuild = sql.includes("-- rebuild-parent:");
        if (rebuild) connection.pragma("foreign_keys = OFF");
        try {
          connection
            .transaction(() => {
              if (
                connection
                  .prepare("SELECT name FROM migrations WHERE name=?")
                  .get(file)
              )
                return;
              connection.exec(sql);
              connection
                .prepare("INSERT INTO migrations VALUES (?,?)")
                .run(file, now());
            })
            .immediate();
        } finally {
          if (rebuild) connection.pragma("foreign_keys = ON");
        }
        if (
          rebuild &&
          (connection.pragma("foreign_key_check") as unknown[]).length
        )
          throw Error("Workspace migration failed its relationship check.");
      }
    }
    globalDb.procureDb = connection;
    globalDb.intakeSchemaReady = true;
  }
  return globalDb.procureDb;
}
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export function one<T>(sql: string, ...args: unknown[]): T | undefined {
  return db()
    .prepare(sql)
    .get(...args) as T | undefined;
}
export function all<T>(sql: string, ...args: unknown[]): T[] {
  return db()
    .prepare(sql)
    .all(...args) as T[];
}
export function run(sql: string, ...args: unknown[]) {
  return db()
    .prepare(sql)
    .run(...args);
}
export function insert(table: string, record: Record<string, unknown>) {
  const keys = Object.keys(record);
  if (
    !/^[a-z_][a-z0-9_]*$/.test(table) ||
    keys.some((k) => !/^[a-z_][a-z0-9_]*$/.test(k))
  )
    throw Error("Invalid identifier");
  return run(
    `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
    ...Object.values(record),
  );
}
export function audit(
  workspace: string,
  request: string | null,
  type: string,
  message: string,
) {
  insert("audit_events", {
    id: id(),
    workspace_id: workspace,
    request_id: request,
    type,
    message,
    created_at: now(),
  });
}
export function events(workspace: string) {
  return all<Audit>(
    "SELECT * FROM audit_events WHERE workspace_id=? ORDER BY created_at DESC, rowid DESC LIMIT 100",
    workspace,
  );
}
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function requireRecord<T>(row: T | undefined): T {
  if (!row)
    throw new DomainError(
      "This record is not available in your workspace.",
      404,
    );
  return row;
}
