import { z } from "zod";
import {
  audit,
  db,
  DomainError,
  id,
  insert,
  now,
  one,
  requireRecord,
  run,
} from "../db";
import { demoState } from "../demo";
import { getRequest } from "../domain";
import type { Call, Supplier, Workspace } from "../types";
import { procurementInstructions } from "./voice";
import { extractCallQuote, transcriptFingerprint } from "./call-quote";

const base = "https://apps.sarvam.ai/api";
const vars = [
  "SARVAM_API_KEY",
  "SARVAM_ORG_ID",
  "SARVAM_WORKSPACE_ID",
  "SARVAM_APP_ID",
  "SARVAM_CONNECTION_ID",
  "SARVAM_AGENT_PHONE",
  "SARVAM_ALLOWED_NUMBERS",
  "SARVAM_APP_VERSION",
];
function ready(w: Workspace) {
  if (w.mode !== "sandbox")
    throw new DomainError(
      "Connect owner sign-in in Settings to place supplier calls. Local and sample workspaces cannot use telephony credentials.",
      503,
    );
  const missing = vars.filter((k) => !process.env[k]);
  if (missing.length)
    throw new DomainError(`Sarvam setup required: ${missing.join(", ")}.`, 503);
  if (process.env.SARVAM_DEMO_AGENT_VERIFIED !== "true")
    throw new DomainError(
      "Verify the committed Sarvam procurement agent uses procurement_brief, respects opt-out and supports your test destinations, then set SARVAM_DEMO_AGENT_VERIFIED=true. See docs/SARVAM_SETUP.md.",
      503,
    );
  if (
    !/^\d+$/.test(process.env.SARVAM_APP_VERSION!) ||
    Number(process.env.SARVAM_APP_VERSION) < 1
  )
    throw new DomainError(
      "Set SARVAM_APP_VERSION to a committed positive version.",
      503,
    );
}
function scope() {
  return [
    process.env.SARVAM_ORG_ID!,
    process.env.SARVAM_WORKSPACE_ID!,
    process.env.SARVAM_APP_ID!,
  ].map(encodeURIComponent);
}
export async function launchDemoCall(
  w: Workspace,
  supplierId: string,
  consent: boolean,
  transport: typeof fetch = fetch,
) {
  const state = requireRecord(demoState(w) || undefined);
  return launchRequestCall(w, state.requestId, supplierId, consent, transport);
}
export async function launchRequestCall(
  w: Workspace,
  requestId: string,
  supplierId: string,
  consent: boolean,
  transport: typeof fetch = fetch,
) {
  ready(w);
  if (!consent)
    throw new DomainError("Confirm this contact has consented to an AI call.");
  const req = getRequest(w.id, requestId);
  if (!req.version) throw new DomainError("Confirm the restock brief first.");
  const supplier = requireRecord(
    req.spec.supplierIds.includes(supplierId)
      ? one<Supplier>(
          "SELECT * FROM suppliers WHERE workspace_id=? AND id=?",
          w.id,
          supplierId,
        )
      : undefined,
  );
  if (supplier.do_not_contact)
    throw new DomainError("This supplier is marked do not contact.");
  if (
    !supplier.phone ||
    !(process.env.SARVAM_ALLOWED_NUMBERS || "")
      .split(",")
      .map((v) => v.trim())
      .includes(supplier.phone)
  )
    throw new DomainError(
      "Provide this contact’s E.164 number and add it to SARVAM_ALLOWED_NUMBERS on the server.",
    );
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: req.spec.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  if (parts < req.spec.outreachStart || parts >= req.spec.outreachEnd)
    throw new DomainError(
      `Calls are allowed ${req.spec.outreachStart}–${req.spec.outreachEnd} ${req.spec.timezone}. Revise the outreach policy to change the schedule.`,
    );
  const brief = procurementInstructions(
    w.name,
    `${req.spec.description}\nQuantity ${req.spec.quantity} ${req.spec.unit}; specification ${req.spec.material}; delivery ${req.spec.destination} by ${req.spec.deadline}; currency ${req.spec.currency}. Speak ${req.spec.language}. Quality requirements: ${req.spec.visualNotes}. Negotiable: ${req.spec.negotiable}. Ask owner before changing: ${req.spec.askOwner}. Ask for a written quote. Ask only for a sandbox PayPal business email or merchant ID, never passwords, OTPs or card details. Repeat it back for written confirmation; spoken payment details are unverified. Do not place an order.`,
  );
  // Persist precisely the context submitted, not a reconstruction of an edited
  // request. Keep credentials and telephone numbers out of this owner-visible log.
  const sentContext = {
    appId: process.env.SARVAM_APP_ID!,
    appVersion: Number(process.env.SARVAM_APP_VERSION),
    agentVariables: {
      procurement_brief: brief,
      supplier_name: supplier.contact.trim() || supplier.company,
    },
  };
  const callId = db().transaction(() => {
    if (
      one(
        "SELECT id FROM calls WHERE workspace_id=? AND request_id=? AND supplier_id=? AND status NOT IN ('failed','completed')",
        w.id,
        req.id,
        supplier.id,
      )
    )
      throw new DomainError(
        "A call attempt already exists. Refresh its provider status to verify it has ended before placing another call.",
        409,
      );
    const cid = id();
    insert("calls", {
      id: cid,
      workspace_id: w.id,
      request_id: req.id,
      supplier_id: supplier.id,
      provider_id: null,
      status: "launching",
      transcript: null,
      facts: JSON.stringify({ requirementVersion: req.version, sentContext }),
      error: null,
      created_at: now(),
      updated_at: now(),
    });
    return cid;
  })();
  try {
    const [org, workspace] = scope();
    const response = await transport(
      `${base}/outbounds/v1/orgs/${org}/workspaces/${workspace}/outbounds`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.SARVAM_API_KEY!,
        },
        body: JSON.stringify({
          app_config: {
            app_id: sentContext.appId,
            app_version: sentContext.appVersion,
            connection_config: {
              connection_id: process.env.SARVAM_CONNECTION_ID,
              agent_phone_number: process.env.SARVAM_AGENT_PHONE,
            },
            agent_variables: sentContext.agentVariables,
            app_overrides: { initial_language_name: req.spec.language },
          },
          user_config: { user_phone_number: supplier.phone },
        }),
        signal: AbortSignal.timeout(25000),
      },
    );
    if (!response.ok) {
      // 4xx validation/auth rejection is definite; timeouts/5xx may have dialled.
      run(
        "UPDATE calls SET status=?,error=?,updated_at=? WHERE id=?",
        response.status >= 400 &&
          response.status < 500 &&
          response.status !== 408
          ? "failed"
          : "uncertain",
        `Sarvam returned ${response.status}.`,
        now(),
        callId,
      );
      throw new DomainError(
        `Sarvam returned ${response.status}. No completed conversation is claimed. Check the attempt before retrying.`,
        502,
      );
    }
    const result = z
      .object({ attempt_id: z.string().min(1) })
      .parse(await response.json());
    run(
      "UPDATE calls SET provider_id=?,status='submitted',updated_at=? WHERE id=?",
      result.attempt_id,
      now(),
      callId,
    );
    audit(
      w.id,
      req.id,
      "call",
      `Real Sarvam test attempt submitted for ${supplier.contact}. Attempt ID recorded; connection and quote are not confirmed.`,
    );
    return { id: callId };
  } catch (e) {
    run(
      "UPDATE calls SET status='uncertain',error='Launch result unresolved. Check the Sarvam dashboard before any redial.',updated_at=? WHERE id=? AND status='launching'",
      now(),
      callId,
    );
    if (e instanceof DomainError) throw e;
    throw new DomainError(
      "Sarvam launch result unresolved. Check the saved attempt in the Sarvam dashboard before any redial.",
      502,
    );
  }
}
export async function syncDemoCall(
  w: Workspace,
  callId: string,
  transport: typeof fetch = fetch,
) {
  const state = requireRecord(demoState(w) || undefined);
  return syncRequestCall(w, state.requestId, callId, transport);
}
export async function syncRequestCall(
  w: Workspace,
  requestId: string,
  callId: string,
  transport: typeof fetch = fetch,
) {
  ready(w);
  const currentRequest = getRequest(w.id, requestId);
  const call = requireRecord(
    one<Call>(
      "SELECT * FROM calls WHERE id=? AND workspace_id=? AND request_id=?",
      callId,
      w.id,
      requestId,
    ),
  );
  if (!call.provider_id)
    throw new DomainError(
      "No provider attempt ID was received. Reconcile in the Sarvam dashboard; redial remains blocked.",
      409,
    );
  const rawFacts = call.facts ? JSON.parse(call.facts) : {};
  const facts =
    rawFacts && typeof rawFacts === "object" && !Array.isArray(rawFacts)
      ? rawFacts
      : {};
  const [org, workspace, configuredApp] = scope();
  const app =
    typeof facts.sentContext?.appId === "string"
      ? encodeURIComponent(facts.sentContext.appId)
      : configuredApp;
  const root = `${base}/analytics/v1/${org}/${workspace}/${app}`;
  const params = new URLSearchParams({
    start_datetime: new Date(
      new Date(call.created_at).getTime() - 60000,
    ).toISOString(),
    end_datetime: now(),
    filter_conditions: JSON.stringify([
      { field: "attempt_id", operator: "equals", value: call.provider_id },
    ]),
    limit: "1",
  });
  const get = async (url: string) => {
    const r = await transport(url, {
      headers: { "X-API-Key": process.env.SARVAM_API_KEY! },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok)
      throw new DomainError(
        `Sarvam status retrieval returned ${r.status}. Try again later; no call will be redialled.`,
        502,
      );
    return r.json();
  };
  const response = z
    .object({
      items: z.array(
        z.object({
          attempt_id: z.string(),
          interaction_id: z.string().nullable().optional(),
          connectivity_status: z.string(),
          failure_reason: z.string().nullable().optional(),
          end_datetime: z.string().nullable().optional(),
        }),
      ),
    })
    .parse(await get(`${root}/attempts?${params}`));
  const attempt = response.items.find((a) => a.attempt_id === call.provider_id);
  if (!attempt) return { pending: true };
  // Connectivity alone is not completion: even 'connected' can describe a
  // finished attempt. Only a valid provider end time releases the retry lock.
  const endTime = attempt.end_datetime
    ? Date.parse(
        /(?:Z|[+-]\d{2}:\d{2})$/.test(attempt.end_datetime)
          ? attempt.end_datetime
          : `${attempt.end_datetime}Z`,
      )
    : NaN;
  const ended = Number.isFinite(endTime) && endTime <= Date.now();
  let transcript = call.transcript;
  if (attempt.interaction_id) {
    const result = z
      .object({
        interaction_id: z.string(),
        messages: z.array(z.object({ role: z.string(), content: z.string() })),
      })
      .parse(
        await get(
          `${root}/transcripts/${encodeURIComponent(attempt.interaction_id)}`,
        ),
      );
    if (result.interaction_id !== attempt.interaction_id)
      throw new DomainError(
        "Provider transcript identity did not match the attempt.",
        502,
      );
    if (result.messages.length)
      transcript = result.messages
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n")
        .slice(0, 50000);
    // These are FINAL provider variables, not proof of the LLM's input context.
    // Diagnostics failure must not discard a verified transcript or end time.
    try {
      const interactionParams = new URLSearchParams(params);
      interactionParams.set(
        "filter_conditions",
        JSON.stringify([
          {
            field: "interaction_id",
            operator: "equals",
            value: attempt.interaction_id,
          },
        ]),
      );
      const interactions = z
        .object({
          items: z.array(
            z.object({
              interaction_id: z.string(),
              job_id: z.string(),
              app_version: z.number().nullable().optional(),
              agent_variables: z
                .object({
                  supplier_name: z.string().optional(),
                  procurement_brief: z.string().optional(),
                })
                .nullable()
                .optional(),
            }),
          ),
        })
        .parse(await get(`${root}/interactions?${interactionParams}`));
      const interaction = interactions.items.find(
        (i) =>
          i.interaction_id === attempt.interaction_id &&
          i.job_id === call.provider_id,
      );
      if (!interaction) throw new Error("No matching provider interaction");
      facts.providerContext = {
        appVersion: interaction.app_version,
        agentVariables: interaction.agent_variables || {},
        checkedAt: now(),
      };
      delete facts.contextError;
    } catch {
      facts.contextError =
        "Provider variable check unavailable or identity did not match. Refresh again; inspect Sarvam Analytics if this persists.";
    }
  }
  if (
    ended &&
    transcript &&
    facts.requirementVersion === currentRequest.version
  ) {
    const fingerprint = transcriptFingerprint(transcript);
    if (facts.quoteDraftFingerprint !== fingerprint) {
      delete facts.quoteDraft;
      try {
        facts.quoteDraft = await extractCallQuote(
          transcript,
          currentRequest.spec.unit,
          call.created_at,
        );
        facts.quoteDraftFingerprint = fingerprint;
        delete facts.quoteDraftError;
      } catch (e) {
        facts.quoteDraftError =
          e instanceof DomainError
            ? e.message
            : "Call quotation extraction failed. Refresh again or enter terms manually.";
      }
    }
  }
  run(
    "UPDATE calls SET status=?,transcript=?,error=?,facts=?,updated_at=? WHERE id=?",
    ended
      ? "completed"
      : `Provider: ${attempt.connectivity_status}`.slice(0, 100),
    transcript,
    attempt.failure_reason === "NO_FAILURE_REASON"
      ? null
      : attempt.failure_reason || null,
    JSON.stringify(facts),
    now(),
    call.id,
  );
  audit(
    w.id,
    requestId,
    "call",
    "Sarvam attempt refreshed. Any extracted call terms are an unconfirmed draft for supplier review; no quotation was submitted or payment recipient verified.",
  );
  return { synced: true };
}
