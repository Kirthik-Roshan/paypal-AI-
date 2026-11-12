import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { id, insert, now, run } from "../src/lib/db";
import {
  invite,
  portalData,
  saveRequest,
  saveSupplier,
  getData,
} from "../src/lib/domain";
import { baseSpec } from "../src/lib/seed";
import type { Workspace } from "../src/lib/types";
import {
  callQuoteSchema,
  extractCallQuote,
} from "../src/lib/providers/call-quote";
const empty = Object.fromEntries(
  Object.keys(callQuoteSchema.shape).map((k) => [
    k,
    { value: null, evidence: null },
  ]),
);
process.env.OPENAI_API_KEY = "mock-only";
process.env.DATABASE_PATH = `/tmp/pp-callquote-${randomUUID()}.db`;
process.env.OPENAI_INTAKE_MODEL = "mock-model";
test("call quotation accepts supplier evidence, rejects assistant-only numbers, and leaves unknown costs blank", async () => {
  const fields = {
    ...empty,
    unitPrice: { value: "1.25", evidence: "USD 1.25 per case" },
    priceUnit: { value: "cases", evidence: "USD 1.25 per case" },
    currency: { value: "USD", evidence: "USD 1.25 per case" },
    shipping: { value: "0", evidence: "shipping is free" },
    tax: { value: "0", evidence: "tax is zero" },
    quantity: { value: "4", evidence: "I can supply 4 cases" },
  };
  const transport = (async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    return Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(fields) }],
        },
      ],
    });
  }) as typeof fetch;
  const draft = await extractCallQuote(
    "assistant: shipping is free\nuser: I can supply 4 cases at USD 1.25 per case.\nuser: tax needs checking",
    "cases",
    "2026-11-12",
    transport,
  );
  assert.equal(draft.unitPrice.value, "1.25");
  assert.equal(draft.quantity.value, "4");
  assert.equal(draft.shipping.value, null);
  assert.equal(draft.tax.value, null);
  assert.equal(draft.paymentContact.value, null);
});
test("ambiguous prices without currency and incomplete responses never become a price draft", async () => {
  const transport = (async () =>
    Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                ...empty,
                unitPrice: { value: "5", evidence: "five per case" },
                priceUnit: { value: "cases", evidence: "five per case" },
              }),
            },
          ],
        },
      ],
    })) as typeof fetch;
  assert.equal(
    (
      await extractCallQuote(
        "user: five per case",
        "cases",
        "2026-11-12",
        transport,
      )
    ).unitPrice.value,
    null,
  );
  await assert.rejects(
    extractCallQuote("user: hello", "cases", "2026-11-12", (async () =>
      Response.json({ status: "incomplete" })) as typeof fetch),
    /incomplete/,
  );
});
test("private portal exposes only its supplier draft for the current requirement version, never a submitted quote", () => {
  const w: Workspace = {
    id: id(),
    name: "Hypermart",
    mode: "sandbox",
    timezone: "UTC",
    created_at: now(),
  };
  insert("workspaces", w);
  const a = saveSupplier(w, { company: "Supplier A" }),
    b = saveSupplier(w, { company: "Supplier B" });
  const r = saveRequest(w, {
    title: "Cola restock",
    category: "Beverages",
    confirm: true,
    spec: {
      ...baseSpec(),
      description: "Cola cases",
      destination: "Chennai",
      supplierIds: [a.id, b.id],
    },
  });
  const callId = id();
  insert("calls", {
    id: callId,
    workspace_id: w.id,
    request_id: r.id,
    supplier_id: a.id,
    provider_id: "mock",
    status: "completed",
    transcript: "user: offer",
    facts: JSON.stringify({ requirementVersion: 1, quoteDraft: empty }),
    error: null,
    created_at: now(),
    updated_at: now(),
  });
  const tokenA = invite(w, r.id, a.id).url.split("/").pop()!,
    tokenB = invite(w, r.id, b.id).url.split("/").pop()!;
  assert.equal(portalData(tokenA).callDraft?.callId, callId);
  assert.equal(portalData(tokenB).callDraft, null);
  assert.equal(getData(w).quotes.length, 0);
  run(
    "UPDATE calls SET facts=? WHERE id=?",
    JSON.stringify({ requirementVersion: 0, quoteDraft: empty }),
    callId,
  );
  assert.equal(portalData(tokenA).callDraft, null);
});
