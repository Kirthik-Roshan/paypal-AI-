import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { id, insert, now, one } from "../src/lib/db";
import { getData, saveRequest, saveSupplier } from "../src/lib/domain";
import {
  launchRequestCall,
  syncRequestCall,
} from "../src/lib/providers/demo-voice";
import type { Call, RequestSpec, Workspace } from "../src/lib/types";

process.env.DATABASE_PATH = `/tmp/procureproof-sarvam-context-${randomUUID()}.db`;
for (const key of [
  "SARVAM_API_KEY",
  "SARVAM_ORG_ID",
  "SARVAM_WORKSPACE_ID",
  "SARVAM_APP_ID",
  "SARVAM_CONNECTION_ID",
  "SARVAM_AGENT_PHONE",
])
  process.env[key] = "mock-only";
process.env.SARVAM_APP_VERSION = "3";
process.env.SARVAM_ALLOWED_NUMBERS = "+919876543210";
process.env.SARVAM_DEMO_AGENT_VERIFIED = "true";

function fixture(
  business: string,
  product: string,
  quantity: number,
  contact = "Prithish",
) {
  const workspace: Workspace = {
    id: id(),
    name: business,
    mode: "sandbox",
    timezone: "UTC",
    created_at: now(),
  };
  insert("workspaces", workspace);
  const supplier = saveSupplier(workspace, {
    company: `${business} Wholesale`,
    contact,
    phone: "+919876543210",
  });
  const spec: RequestSpec = {
    description: product,
    quantity,
    unit: "cases",
    dimensions: "",
    material: "24 × 250 ml",
    colour: "",
    exactText: "",
    requiredElement: "",
    visualNotes: "Sealed cases",
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    currency: "USD",
    budget: 100000,
    destination: "12 Market Street, Chennai",
    taxIncluded: false,
    shippingIncluded: false,
    alternatives: "None",
    supplierIds: [supplier.id],
    discover: false,
    region: "Chennai",
    maxContacts: 0,
    language: "English",
    channel: "Phone",
    outreachStart: "00:00",
    outreachEnd: "23:59",
    timezone: "UTC",
    negotiable: "Unit price",
    askOwner: "All specification changes",
  };
  const request = saveRequest(workspace, {
    title: product,
    category: "General goods",
    spec,
    confirm: true,
  });
  return { workspace, request, supplier, spec };
}

type Payload = {
  app_config: {
    app_id: string;
    app_version: number;
    agent_variables: { supplier_name: string; procurement_brief: string };
  };
};
function facts(callId: string) {
  const call = one<Call>("SELECT * FROM calls WHERE id=?", callId)!;
  return { call, data: JSON.parse(call.facts!) };
}

test("outbound variables and saved snapshots belong to the selected workspace and request", async () => {
  const first = fixture("Harbor Hypermart", "Cola cans", 4);
  const second = fixture("Meadow Grocer", "Orange juice bottles", 7, "");
  const payloads: Payload[] = [];
  const transport = (async (_url, init) => {
    assert.equal(init?.method, "POST");
    payloads.push(JSON.parse(String(init?.body)));
    return Response.json({ attempt_id: `mock-context-${payloads.length}` });
  }) as typeof fetch;
  await assert.rejects(
    launchRequestCall(
      second.workspace,
      first.request.id,
      first.supplier.id,
      true,
      transport,
    ),
    /not available in your workspace/,
  );
  await assert.rejects(
    launchRequestCall(
      first.workspace,
      first.request.id,
      second.supplier.id,
      true,
      transport,
    ),
    /not available in your workspace/,
  );
  assert.equal(payloads.length, 0);

  const calls = [];
  for (const f of [first, second]) {
    calls.push(
      await launchRequestCall(
        f.workspace,
        f.request.id,
        f.supplier.id,
        true,
        transport,
      ),
    );
  }
  for (const [index, f] of [first, second].entries()) {
    const payload = payloads[index].app_config;
    const { data } = facts(calls[index].id);
    assert.deepEqual(data.sentContext, {
      appId: payload.app_id,
      appVersion: payload.app_version,
      agentVariables: payload.agent_variables,
    });
    assert.equal(data.requirementVersion, 1);
    assert.equal(payload.app_version, 3);
    assert.ok(
      payload.agent_variables.procurement_brief.includes(f.workspace.name),
    );
    assert.ok(
      payload.agent_variables.procurement_brief.includes(f.spec.description),
    );
    assert.ok(
      payload.agent_variables.procurement_brief.includes(
        `Quantity ${f.spec.quantity} cases`,
      ),
    );
    assert.ok(
      payload.agent_variables.procurement_brief.includes(f.spec.deadline),
    );
    assert.ok(
      !payload.agent_variables.procurement_brief.includes(
        [second, first][index].workspace.name,
      ),
    );
    assert.ok(
      !payload.agent_variables.procurement_brief.includes(
        [second, first][index].spec.description,
      ),
    );
    assert.equal(getData(f.workspace).quotes.length, 0);
  }
  assert.equal(
    payloads[0].app_config.agent_variables.supplier_name,
    "Prithish",
  );
  assert.equal(
    payloads[1].app_config.agent_variables.supplier_name,
    "Meadow Grocer Wholesale",
  );
});

test("provider context is matched to the exact conversation and retained separately from the sent brief", async () => {
  const f = fixture("Context Test Shop", "Cola restock", 4);
  const launched = await launchRequestCall(
    f.workspace,
    f.request.id,
    f.supplier.id,
    true,
    (async () =>
      Response.json({ attempt_id: "mock-context-provider" })) as typeof fetch,
  );
  const sent = facts(launched.id).data.sentContext;
  const interactionId = "20261111/mock-context";
  let wrongIdentity = false;
  let unavailable = false;
  const transport = (async (url) => {
    const parsed = new URL(String(url));
    if (parsed.pathname.endsWith("/attempts"))
      return Response.json({
        items: [
          {
            attempt_id: "mock-context-provider",
            interaction_id: interactionId,
            connectivity_status: "connected",
            end_datetime: new Date(Date.now() - 1000).toISOString(),
          },
        ],
      });
    if (parsed.pathname.includes("/transcripts/"))
      return Response.json({
        interaction_id: interactionId,
        messages: [
          { role: "assistant", content: "We need the confirmed cola stock." },
        ],
      });
    assert.ok(parsed.pathname.endsWith("/interactions"));
    assert.ok(
      parsed.searchParams.get("filter_conditions")?.includes(interactionId),
    );
    if (unavailable)
      return Response.json({ error: "mock unavailable" }, { status: 503 });
    return Response.json({
      items: [
        {
          interaction_id: interactionId,
          job_id: wrongIdentity ? "another-attempt" : "mock-context-provider",
          app_version: 3,
          agent_variables: {
            supplier_name: "Prithish",
            procurement_brief:
              "Provider final brief differs from the original sent brief",
            unrelated_private_field: "Do not persist this unrelated variable",
          },
        },
      ],
    });
  }) as typeof fetch;
  wrongIdentity = true;
  await syncRequestCall(f.workspace, f.request.id, launched.id, transport);
  assert.equal(facts(launched.id).data.providerContext, undefined);
  assert.ok(facts(launched.id).data.contextError);

  wrongIdentity = false;
  await syncRequestCall(f.workspace, f.request.id, launched.id, transport);
  const synced = facts(launched.id);
  assert.deepEqual(synced.data.sentContext, sent);
  assert.deepEqual(synced.data.providerContext.agentVariables, {
    supplier_name: "Prithish",
    procurement_brief:
      "Provider final brief differs from the original sent brief",
  });
  assert.equal(synced.data.providerContext.appVersion, 3);
  assert.ok(synced.data.providerContext.checkedAt);
  assert.ok(!synced.data.contextError);
  assert.equal(synced.call.status, "completed");
  assert.match(synced.call.transcript!, /confirmed cola stock/);

  unavailable = true;
  await syncRequestCall(f.workspace, f.request.id, launched.id, transport);
  assert.ok(facts(launched.id).data.contextError);
  assert.equal(facts(launched.id).call.status, "completed");
  assert.equal(getData(f.workspace).quotes.length, 0);
});
