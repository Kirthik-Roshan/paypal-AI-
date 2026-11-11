import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { insert, id, now, one, run } from "../src/lib/db";
import { demoState, demoSuppliers, saveDemo, startDemo } from "../src/lib/demo";
import { getData, getRequest, invite, portalData } from "../src/lib/domain";
import {
  intakeMessage,
  parseRestockMessage,
} from "../src/lib/providers/intake";
import { launchDemoCall, syncDemoCall } from "../src/lib/providers/demo-voice";
import { nearbyBeverageSuppliers } from "../src/lib/providers/places";
import type { Call, Workspace } from "../src/lib/types";
process.env.DATABASE_PATH = `/tmp/procureproof-demo-${randomUUID()}.db`;
function workspace(mode: Workspace["mode"] = "local"): Workspace {
  const w = {
    id: id(),
    name: "Beacon Supermarket",
    mode,
    timezone: "Asia/Kolkata",
    created_at: now(),
  };
  insert("workspaces", w);
  return w;
}
const brief =
  "I need 40 cases of cola; pack 24 x 250 ml; budget USD 600; deliver to 12 Market Street, Chennai; delivery 2026-12-01; Prithish +919876543210; Karthick +919876543211; speak Tamil.";
test("demo preserves business and starts without invented suppliers, quotations or payments; chat persists extraction and scopes private context", async () => {
  const w = workspace();
  const state = startDemo(w);
  assert.equal(startDemo(w).requestId, state.requestId);
  assert.equal(state.config.quantity, 0);
  assert.equal(getData(w).suppliers.length, 0);
  assert.equal(getData(w).payments.length, 0);
  assert.throws(
    () => saveDemo(w, { config: state.config, confirm: true }),
    /Please provide/,
  );
  const result = await intakeMessage(w, { message: brief });
  assert.equal(result.engine, "Local parser");
  const c = result.demo!.config;
  assert.equal(c.quantity, 40);
  assert.equal(c.budget, 60000);
  assert.equal(c.pack, "24 × 250 ml per case");
  assert.equal(c.language, "Tamil");
  assert.equal(c.prithishPhone, "+919876543210");
  assert.equal(c.karthickPhone, "+919876543211");
  saveDemo(w, { config: c, confirm: true });
  assert.equal(demoState(w)?.confirmed, true);
  assert.equal(demoSuppliers(w).length, 2);
  assert.equal(getRequest(w.id, state.requestId).version, 1);
  assert.equal(getData(w).quotes.length, 0);
  assert.equal(
    one<Workspace>("SELECT * FROM workspaces WHERE id=?", w.id)?.name,
    "Beacon Supermarket",
  );
  assert.throws(() => saveDemo(w, { config: c, confirm: true }), /frozen/);
  await assert.rejects(intakeMessage(w, { message: "change it" }), /confirmed/);
  const other = workspace();
  assert.equal(demoState(other), null);
  const url = invite(w, state.requestId, demoSuppliers(w)[0].id).url;
  const p = portalData(url.split("/").pop()!);
  assert.equal(p.demo, true);
  assert.ok(!JSON.stringify(p.requirements).includes("600"));
  assert.equal(p.assets.length, 0);
  assert.equal(getData(w).calls.length, 0);
  await assert.rejects(
    launchDemoCall(w, demoSuppliers(w)[0].id, true),
    /Connect owner/,
  );
});
test("real model response is validated and cannot confirm or contact suppliers; attachments are opt-in and errors do not invent facts", async () => {
  const w = workspace();
  const s = startDemo(w);
  process.env.GEMINI_API_KEY = "test-only";
  process.env.GEMINI_INTAKE_MODEL = "test-model";
  process.env.DEMO_LOCAL_AI_ENABLED = "true";
  let payload: any;
  const transport = (async (_url, init) => {
    payload = JSON.parse(String(init?.body));
    return Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  reply: "What pack size and delivery address do you need?",
                  config: { ...s.config, need: "Cola", quantity: 30 },
                }),
              },
            ],
          },
        },
      ],
    });
  }) as typeof fetch;
  const result = await intakeMessage(
    w,
    { message: "30 cases please", useFiles: false },
    transport,
  );
  assert.equal(result.demo?.config.quantity, 30);
  assert.equal(result.demo?.confirmed, false);
  assert.equal(getData(w).suppliers.length, 0);
  assert.equal(payload.contents[0].parts.length, 1);
  await assert.rejects(
    intakeMessage(w, { message: "hello" }, (async () =>
      Response.json({ error: "test" }, { status: 429 })) as typeof fetch),
    /429/,
  );
  assert.equal(demoState(w)?.messages.length, 3);
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_INTAKE_MODEL;
  delete process.env.DEMO_LOCAL_AI_ENABLED;
});
test("Sarvam demo calls use persisted attempts, block redial on ambiguous response and retrieve canonical transcripts without creating quotes", async () => {
  const w = workspace("sandbox");
  const s = startDemo(w);
  const c = parseRestockMessage(s.config, brief);
  saveDemo(w, { config: c, confirm: true });
  for (const key of [
    "SARVAM_API_KEY",
    "SARVAM_ORG_ID",
    "SARVAM_WORKSPACE_ID",
    "SARVAM_APP_ID",
    "SARVAM_CONNECTION_ID",
    "SARVAM_AGENT_PHONE",
  ])
    process.env[key] = "mock-only";
  process.env.SARVAM_ALLOWED_NUMBERS = "+919876543210,+919876543211";
  process.env.SARVAM_APP_VERSION = "1";
  process.env.SARVAM_DEMO_AGENT_VERIFIED = "true";
  const r = getRequest(w.id, s.requestId);
  r.spec.outreachStart = "00:00";
  r.spec.outreachEnd = "23:59";
  run("UPDATE requests SET spec=? WHERE id=?", JSON.stringify(r.spec), r.id);
  const suppliers = demoSuppliers(w);
  let launches = 0;
  const submit = (async (_u, init) => {
    launches++;
    const b = JSON.parse(String(init?.body));
    assert.ok(
      b.app_config.agent_variables.procurement_brief.includes("sandbox PayPal"),
    );
    return Response.json({ attempt_id: launches === 1 ? "real-mock-attempt" : `real-mock-attempt-${launches}` });
  }) as typeof fetch;
  await assert.rejects(
    launchDemoCall(w, suppliers[0].id, false, submit),
    /consented/,
  );
  const result = await launchDemoCall(w, suppliers[0].id, true, submit);
  await assert.rejects(
    launchDemoCall(w, suppliers[0].id, true, submit),
    /already exists/,
  );
  assert.equal(launches, 1);
  await syncDemoCall(w, result.id, (async (url) =>
    String(url).includes("/attempts?")
      ? Response.json({
          items: [
            {
              attempt_id: "real-mock-attempt",
              interaction_id: "20261109/mock",
              connectivity_status: "connected",
              failure_reason: "NO_FAILURE_REASON",
            },
          ],
        })
      : Response.json({
          interaction_id: "20261109/mock",
          messages: [
            { role: "user", content: "My quote will be supplied in writing." },
          ],
        })) as typeof fetch);
  assert.match(
    one<Call>("SELECT * FROM calls WHERE id=?", result.id)!.transcript!,
    /in writing/,
  );
  assert.equal(getData(w).quotes.length, 0);
  await assert.rejects(
    launchDemoCall(w, suppliers[0].id, true, submit),
    /already exists/,
  );
  await syncDemoCall(w, result.id, (async () =>
    Response.json({
      items: [
        {
          attempt_id: "real-mock-attempt",
          connectivity_status: "not_connected",
          failure_reason: "NO_ANSWER",
          end_datetime: new Date(Date.now() - 1000).toISOString(),
        },
      ],
    })) as typeof fetch);
  assert.equal(
    one<Call>("SELECT * FROM calls WHERE id=?", result.id)!.status,
    "completed",
  );
  await launchDemoCall(w, suppliers[0].id, true, submit);
  assert.equal(launches, 2);
  await assert.rejects(
    launchDemoCall(w, suppliers[1].id, true, (async () => {
      throw new Error("timeout");
    }) as typeof fetch),
    /unresolved/,
  );
  await assert.rejects(
    launchDemoCall(w, suppliers[1].id, true, submit),
    /already exists/,
  );
  assert.equal(launches, 2);
});
test("Google Places search preserves real provider results and handles missing/failed provider honestly", async () => {
  const w = workspace("sandbox");
  delete process.env.GOOGLE_PLACES_API_KEY;
  await assert.rejects(
    nearbyBeverageSuppliers(w, "Chennai India"),
    /GOOGLE_PLACES_API_KEY/,
  );
  process.env.GOOGLE_PLACES_API_KEY = "mock-only";
  const response = await nearbyBeverageSuppliers(w, "Chennai India", (async (
    _url,
    init,
  ) => {
    assert.match(String(init?.body), /Chennai/);
    return Response.json({
      places: [
        {
          id: "provider-id",
          displayName: { text: "Actual mock provider listing" },
          formattedAddress: "Chennai",
        },
      ],
    });
  }) as typeof fetch);
  assert.equal(response.places[0].id, "provider-id");
  assert.equal(getData(w).suppliers.length, 0);
  assert.equal(getData(w).calls.length, 0);
  await assert.rejects(
    nearbyBeverageSuppliers(w, "Chennai India", (async () =>
      Response.json({ error: "billing" }, { status: 403 })) as typeof fetch),
    /403/,
  );
});
