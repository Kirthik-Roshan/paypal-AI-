import { auth } from "@/auth";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DomainError, id, insert, now, one, requireRecord } from "./db";
import { seedWorkspace } from "./seed";
import type { Mode, Workspace } from "./types";

function key() {
  if (process.env.SESSION_SECRET) {
    if (process.env.SESSION_SECRET.length < 32)
      throw new DomainError(
        "SESSION_SECRET must contain at least 32 characters.",
        503,
      );
    return new TextEncoder().encode(process.env.SESSION_SECRET);
  }
  if (process.env.NODE_ENV === "production")
    throw new DomainError(
      "Set SESSION_SECRET before running a production server.",
      503,
    );
  const file = path.join(
    path.dirname(
      process.env.DATABASE_PATH ||
        path.join(process.cwd(), "data/procureproof.db"),
    ),
    ".session-key",
  );
  mkdirSync(path.dirname(file), { recursive: true });
  if (!existsSync(file)) {
    try {
      writeFileSync(file, randomBytes(48).toString("hex"), {
        mode: 0o600,
        flag: "wx",
      });
    } catch (e) {
      if (!existsSync(file)) throw e;
    }
  }
  return new TextEncoder().encode(readFileSync(file, "utf8"));
}
export function authConfigured() {
  return !!(
    process.env.AUTH_SECRET &&
    process.env.AUTH_GITHUB_ID &&
    process.env.AUTH_GITHUB_SECRET &&
    process.env.AUTH_OWNER_GITHUB_LOGINS
  );
}
export async function sessionOptional(
  cookieName = "pp_workspace",
): Promise<Workspace | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      issuer: "procureproof",
      audience: "workspace",
    });
    const workspace = one<Workspace>(
      "SELECT * FROM workspaces WHERE id=?",
      payload.sub,
    );
    if (workspace?.mode === "sandbox") {
      const user = authConfigured() ? (await auth())?.user : null;
      if (!user?.id || workspace.owner_id !== user.id)
        throw new DomainError(
          "Sign in again to open your connected sandbox workspace.",
          403,
        );
    }
    return workspace || null;
  } catch (e) {
    if (e instanceof DomainError) throw e;
    return null;
  }
}
export async function session() {
  const workspace = await sessionOptional();
  if (!workspace) throw new DomainError("Open a workspace to continue.", 401);
  return workspace;
}
export async function openWorkspace(
  mode: Mode,
  business?: { name: string; timezone: string },
) {
  key();
  const existing = await sessionOptional();
  let workspaceId = existing?.mode === mode ? existing.id : "";
  if (mode === "local") {
    if (!business?.name.trim()) {
      const previous = await sessionOptional("pp_business");
      if (!previous || previous.mode === "sample")
        throw new DomainError("Create your business workspace first.");
      workspaceId = previous.id;
    } else {
      workspaceId = id();
      insert("workspaces", {
        id: workspaceId,
        name: business.name.trim(),
        mode: "local",
        timezone: business.timezone,
        created_at: now(),
      });
      const { audit } = await import("./db");
      audit(
        workspaceId,
        null,
        "workspace",
        "Business workspace created. Start by adding your first request or supplier.",
      );
    }
  } else if (mode === "sample") {
    workspaceId ||= id();
    await seedWorkspace(workspaceId);
  } else {
    if (!authConfigured())
      throw new DomainError(
        "Configure GitHub owner sign-in in Settings before opening connected sandbox.",
        503,
      );
    const user = (await auth())?.user;
    if (!user?.id)
      throw new DomainError(
        "Sign in with your approved GitHub owner account.",
        401,
      );
    const owned = one<Workspace>(
      "SELECT * FROM workspaces WHERE owner_id=?",
      user.id,
    );
    workspaceId =
      owned?.id || (existing?.mode === "local" ? existing.id : id());
    if (!owned && existing?.mode === "local") {
      const { run } = await import("./db");
      run(
        "UPDATE workspaces SET mode='sandbox',owner_id=? WHERE id=?",
        user.id,
        workspaceId,
      );
    }
    if (!one("SELECT id FROM workspaces WHERE id=?", workspaceId))
      insert("workspaces", {
        id: workspaceId,
        name: business?.name || process.env.WORKSPACE_NAME || "My business",
        mode: "sandbox",
        timezone: "Asia/Kolkata",
        created_at: now(),
        owner_id: user.id,
      });
  }
  const token = await new SignJWT({ mode })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(workspaceId)
    .setIssuer("procureproof")
    .setAudience("workspace")
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
  (await cookies()).set("pp_workspace", token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" &&
      !(process.env.APP_URL || "").startsWith("http://localhost"),
    path: "/",
    maxAge: 604800,
  });
  if (mode !== "sample")
    (await cookies()).set("pp_business", token, {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV === "production" &&
        !(process.env.APP_URL || "").startsWith("http://localhost"),
      path: "/",
      maxAge: 604800,
    });
  return requireRecord(
    one<Workspace>("SELECT * FROM workspaces WHERE id=?", workspaceId),
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : `${new URL(request.url).protocol}//${request.headers.get("host") || new URL(request.url).host}`;
  if (!origin || origin !== expected)
    throw new DomainError("This action must come from the application.", 403);
}
const limits = new Map<string, { count: number; until: number }>();
export function rateLimit(key: string, max = 60) {
  const t = Date.now();
  const v = limits.get(key);
  if (!v || v.until < t) {
    limits.set(key, { count: 1, until: t + 60000 });
    return;
  }
  if (++v.count > max)
    throw new DomainError(
      "Too many attempts. Please try again in a minute.",
      429,
    );
}
