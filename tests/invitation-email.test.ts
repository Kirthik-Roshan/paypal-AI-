import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { id, insert, now, one } from "../src/lib/db";
import { invite, saveRequest, saveSupplier } from "../src/lib/domain";
import { baseSpec } from "../src/lib/seed";
import { emailInvitation, publicAppOrigin } from "../src/lib/providers/email";
import type { Workspace } from "../src/lib/types";
process.env.DATABASE_PATH = `/tmp/pp-email-${randomUUID()}.db`;
function fixture() {
  const w: Workspace = {
    id: id(),
    name: "Hypermart",
    mode: "sandbox",
    timezone: "UTC",
    created_at: now(),
  };
  insert("workspaces", w);
  const s = saveSupplier(w, {
    company: "Supplier",
    email: "supplier@example.com",
  });
  const r = saveRequest(w, {
    title: "Cola purchase",
    category: "Beverages",
    confirm: true,
    spec: {
      ...baseSpec(),
      description: "Four cases of cola",
      destination: "Chennai",
      supplierIds: [s.id],
    },
  });
  const invitation = invite(w, r.id, s.id);
  return { w, r, token: invitation.url.split("/").pop()! };
}
test("email requires public deployment, scopes invitation, and records acceptance once", async () => {
  const f = fixture(),
    other = fixture();
  process.env.RESEND_API_KEY = "mock-only";
  process.env.EMAIL_FROM = "ProcureProof <quotes@example.com>";
  process.env.APP_URL = "http://localhost:3000";
  const unexpected = (async () => {
    throw Error("Must not send");
  }) as typeof fetch;
  assert.equal(publicAppOrigin(), null);
  await assert.rejects(
    emailInvitation(f.w, f.r.id, f.token, unexpected),
    /public HTTPS/,
  );
  process.env.APP_URL = "https://procureproof.example.com";
  await assert.rejects(
    emailInvitation(other.w, other.r.id, f.token, unexpected),
    /workspace/,
  );
  let sends = 0;
  const transport = (async (_url, init) => {
    sends++;
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.to, ["supplier@example.com"]);
    assert.ok(
      body.text.includes(`https://procureproof.example.com/quote/${f.token}`),
    );
    assert.ok(!body.text.includes("localhost"));
    assert.ok(!body.text.includes("1500"));
    return Response.json({ id: "mock-email" });
  }) as typeof fetch;
  assert.equal(
    (await emailInvitation(f.w, f.r.id, f.token, transport)).accepted,
    true,
  );
  await emailInvitation(f.w, f.r.id, f.token, transport);
  assert.equal(sends, 1);
});
test("ambiguous email response does not claim success or allow automatic redelivery", async () => {
  const f = fixture();
  process.env.APP_URL = "https://procureproof.example.com";
  await assert.rejects(
    emailInvitation(f.w, f.r.id, f.token, (async () => {
      throw Error("timeout");
    }) as typeof fetch),
    /uncertain/,
  );
  assert.equal(
    one<{ status: string }>(
      "SELECT status FROM invitation_emails ORDER BY rowid DESC LIMIT 1",
    )?.status,
    "uncertain",
  );
  await assert.rejects(
    emailInvitation(f.w, f.r.id, f.token, fetch),
    /already exists/,
  );
});
