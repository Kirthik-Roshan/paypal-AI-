import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { id, insert, now } from "../src/lib/db";
import {
  createIntake,
  saveIntake,
  readIntake,
  chatIntake,
} from "../src/lib/request-intake";
import { getData, getRequest, invite, portalData } from "../src/lib/domain";
import type { Workspace } from "../src/lib/types";
import { storeAsset } from "../src/lib/uploads";
import { PDFDocument } from "pdf-lib";
process.env.DATABASE_PATH = `/tmp/request-intake-${randomUUID()}.db`;
function fixture() {
  const w: Workspace = {
    id: id(),
    name: "KIRTHIK'S HYPERMART",
    mode: "local",
    timezone: "Asia/Kolkata",
    created_at: now(),
  };
  insert("workspaces", w);
  return w;
}
test("OpenAI receives only opted-in private context from this request in the documented file format", async () => {
  const w = fixture(),
    s = createIntake(w),
    other = createIntake(w);
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = Buffer.from(await pdf.save());
  storeAsset(
    w.id,
    s.requestId,
    "stock.pdf",
    "application/pdf",
    bytes,
    "Buyer context",
  );
  storeAsset(
    w.id,
    other.requestId,
    "other-private.pdf",
    "application/pdf",
    bytes,
    "Buyer context",
  );
  process.env.OPENAI_API_KEY = "mock-only";
  process.env.OPENAI_INTAKE_MODEL = "mock-model";
  process.env.LOCAL_AI_ENABLED = "true";
  const transport = (async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    const parts = body.input[0].content;
    assert.equal(parts.length, 2);
    assert.equal(parts[1].type, "input_file");
    assert.equal(parts[1].filename, "stock.pdf");
    assert.ok(parts[1].file_data.startsWith("data:application/pdf;base64,"));
    assert.ok(!JSON.stringify(body).includes("other-private.pdf"));
    return Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                reply: "Please confirm the quantity.",
                config: s.config,
              }),
            },
          ],
        },
      ],
    });
  }) as typeof fetch;
  await chatIntake(
    w,
    s.requestId,
    {
      message: "Read my stock report",
      config: s.config,
      revision: 0,
      useFiles: true,
    },
    transport,
  );
  assert.equal(readIntake(w, s.requestId).messages.length, 3);
});
test("normal business request intake persists, isolates revisions and freezes suppliers without creating calls or offers", () => {
  const w = fixture(),
    initial = createIntake(w);
  assert.equal(initial.config.language, "English");
  assert.equal(initial.config.suppliers.length, 0);
  const c = {
    ...initial.config,
    title: "Soft-drink inventory restock",
    category: "Beverage wholesale",
    description: "Sealed soft drinks",
    quantity: 80,
    unit: "cases",
    packSize: "24 × 250 ml cans per case",
    productMix: "40 Coca-Cola, 20 Sprite, 20 Fanta Orange",
    destination: "24 GST Road, Chromepet, Chennai 600044",
    deadline: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
    budget: 90000,
    stockRequirements: "Sealed cases and six months before expiry",
    suppliers: [
      {
        name: "Prithish",
        phone: "+919876543210",
        email: "",
        relationship: "Regular" as const,
      },
      {
        name: "Karthick",
        phone: "+919876543211",
        email: "",
        relationship: "Newly discovered" as const,
      },
    ],
  };
  const saved = saveIntake(w, initial.requestId, { config: c, revision: 0 });
  assert.equal(saved.revision, 1);
  assert.throws(
    () => saveIntake(w, initial.requestId, { config: c, revision: 0 }),
    /another tab/,
  );
  const confirmed = saveIntake(w, initial.requestId, {
    config: c,
    revision: 1,
    confirm: true,
  });
  assert.ok(confirmed.confirmed);
  const r = getRequest(w.id, initial.requestId);
  assert.equal(r.spec.quantity, 80);
  assert.equal(r.spec.language, "English");
  assert.equal(r.spec.supplierIds.length, 2);
  assert.equal(r.spec.visualNotes, c.stockRequirements);
  assert.equal(getData(w).calls.length, 0);
  assert.equal(getData(w).quotes.length, 0);
  const token = invite(w, r.id, r.spec.supplierIds[0]).url.split("/").pop()!;
  assert.ok(!JSON.stringify(portalData(token)).includes("90000"));
  assert.throws(() => readIntake(fixture(), r.id), /not available/);
  assert.throws(
    () => saveIntake(w, r.id, { config: c, revision: 2 }),
    /confirmed/,
  );
});
test("OpenAI Responses schema, validated draft inference and failed response do not confirm or launch actions", async () => {
  const w = fixture(),
    initial = createIntake(w);
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_INTAKE_MODEL;
  await assert.rejects(
    chatIntake(w, initial.requestId, {
      message: "I need cola",
      config: initial.config,
      revision: 0,
    }),
    /OpenAI setup required/,
  );
  process.env.OPENAI_API_KEY = "mock-only";
  process.env.OPENAI_INTAKE_MODEL = "mock-model";
  process.env.LOCAL_AI_ENABLED = "true";
  const response = await chatIntake(
    w,
    initial.requestId,
    {
      message: "80 cases in English please",
      config: initial.config,
      revision: 0,
    },
    (async (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const payload = JSON.parse(String(init?.body));
      assert.equal(payload.store, false);
      assert.equal(payload.text.format.strict, true);
      assert.equal(payload.text.format.type, "json_schema");
      return Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  reply: "What is the delivery address and pack size?",
                  config: {
                    ...initial.config,
                    quantity: 80,
                    unit: "cases",
                    language: "English",
                  },
                }),
              },
            ],
          },
        ],
      });
    }) as typeof fetch,
  );
  assert.equal(response.config.quantity, 80);
  assert.equal(response.messages.length, 3);
  assert.equal(response.confirmed, false);
  assert.equal(getData(w).suppliers.length, 0);
  await assert.rejects(
    chatIntake(
      w,
      initial.requestId,
      { message: "continue", config: response.config, revision: 1 },
      (async () =>
        Response.json({ error: "quota" }, { status: 429 })) as typeof fetch,
    ),
    /429/,
  );
  assert.equal(readIntake(w, initial.requestId).revision, 1);
  await assert.rejects(
    chatIntake(
      w,
      initial.requestId,
      { message: "continue", config: response.config, revision: 1 },
      (async () =>
        Response.json({ status: "completed", output: [] })) as typeof fetch,
    ),
    /usable structured/,
  );
  assert.equal(readIntake(w, initial.requestId).revision, 1);
});
