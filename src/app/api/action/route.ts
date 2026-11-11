import {
  audit,
  DomainError,
  id,
  insert,
  now,
  one,
  requireRecord,
  run,
} from "@/lib/db";
import {
  addSubmission,
  getAgreement,
  getRequest,
  invite,
  reviewDecision,
  saveRequest,
  saveSupplier,
  selectQuote,
} from "@/lib/domain";
import { apiError } from "@/lib/http";
import { paymentAction, paypalPreflight } from "@/lib/providers/paypal";
import { queueDiscovery } from "@/lib/providers/search";
import { launchOutreach } from "@/lib/providers/voice";
import { launchRequestCall, syncRequestCall } from "@/lib/providers/demo-voice";
import { examplePdf } from "@/lib/seed";
import { rateLimit, sameOrigin, session } from "@/lib/session";
import type { Job, Supplier } from "@/lib/types";
import { removeAsset, storeAsset } from "@/lib/uploads";
import { NextResponse } from "next/server";
import { z } from "zod";
import { emailInvitation, publicAppOrigin } from "@/lib/providers/email";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const w = await session();
    rateLimit(w.id, 120);
    const body = z
      .object({
        action: z.string(),
        requestId: z.string().optional(),
        data: z.any().optional(),
      })
      .parse(await request.json());
    const rid = body.requestId || "";
    const data = body.data || {};
    let result: unknown;
    if (body.action === "workspace.update") {
      const values = z
        .object({
          name: z.string().trim().min(2).max(100),
          timezone: z.string(),
        })
        .parse(data);
      try {
        new Intl.DateTimeFormat("en", { timeZone: values.timezone });
      } catch {
        throw new DomainError("Choose a valid time zone.");
      }
      run(
        "UPDATE workspaces SET name=?,timezone=? WHERE id=?",
        values.name,
        values.timezone,
        w.id,
      );
      audit(w.id, null, "workspace", "Business profile updated.");
      result = { saved: true };
    } else if (body.action === "request.save") result = saveRequest(w, data);
    else if (body.action === "supplier.save") result = saveSupplier(w, data);
    else if (body.action === "invitation.create") {
      const invitation = invite(w, rid, z.string().parse(data.supplierId));
      const origin = publicAppOrigin();
      result = {
        ...invitation,
        publicUrl: origin ? origin + invitation.url : null,
      };
    } else if (body.action === "invitation.email")
      result = await emailInvitation(w, rid, z.string().parse(data.token));
    else if (body.action === "quote.select")
      result = selectQuote(w, rid, z.string().parse(data.quoteId));
    else if (body.action === "review.decide")
      result = reviewDecision(
        w,
        rid,
        z.string().parse(data.decision),
        z
          .string()
          .max(3000)
          .parse(data.note || ""),
        data.acknowledge === true,
      );
    else if (body.action === "review.analyze") {
      getRequest(w.id, rid);
      if (!getAgreement(w.id, rid))
        throw new DomainError(
          "Select a supplier and confirm an agreement first.",
        );
      const active = one<Job>(
        "SELECT * FROM jobs WHERE workspace_id=? AND request_id=? AND kind='analysis' AND status IN ('queued','running')",
        w.id,
        rid,
      );
      if (active) result = { id: active.id };
      else {
        const jid = id();
        insert("jobs", {
          id: jid,
          workspace_id: w.id,
          request_id: rid,
          kind: "analysis",
          payload: "{}",
          status: "queued",
          attempts: 0,
          run_after: now(),
          locked_at: null,
          error: null,
          created_at: now(),
        });
        result = { id: jid };
      }
    } else if (body.action === "asset.remove")
      result = removeAsset(w, z.string().parse(data.assetId));
    else if (body.action === "sample.submission") {
      if (w.mode !== "sample")
        throw new DomainError(
          "Example documents can only be used in the sample workspace.",
          403,
        );
      getRequest(w.id, rid);
      const kind = z
        .enum(["correct", "wrong-phone", "missing-element"])
        .parse(data.kind);
      const file = await examplePdf(kind);
      const aid = storeAsset(
        w.id,
        rid,
        `Juniper-${kind}.pdf`,
        "application/pdf",
        file.bytes,
        "Supplier submission",
        file.preview,
      );
      try {
        result = addSubmission(w.id, rid, aid);
      } catch (e) {
        run("DELETE FROM assets WHERE id=?", aid);
        throw e;
      }
    } else if (body.action === "discovery.start")
      result = queueDiscovery(w, rid);
    else if (body.action === "outreach.call")
      result = await launchRequestCall(
        w,
        rid,
        z.string().parse(data.supplierId),
        data.consent === true,
      );
    else if (body.action === "outreach.sync")
      result = await syncRequestCall(w, rid, z.string().parse(data.callId));
    else if (body.action === "outreach.launch") result = launchOutreach(w, rid);
    else if (body.action === "payment.preflight")
      result = await paypalPreflight();
    else if (body.action.startsWith("payment."))
      result = await paymentAction(w, rid, body.action.slice(8), data);
    else if (body.action === "supplier.mapMerchant") {
      if (w.mode !== "sandbox" || !process.env.PAYPAL_MERCHANT_ID)
        throw new DomainError(
          "Configure the dedicated PayPal sandbox merchant first.",
          503,
        );
      const supplier = requireRecord(
        one<Supplier>(
          "SELECT * FROM suppliers WHERE id=? AND workspace_id=?",
          data.supplierId,
          w.id,
        ),
      );
      if (
        one(
          "SELECT d.request_id FROM demo_sessions d JOIN requests r ON r.id=d.request_id WHERE d.workspace_id=? AND EXISTS (SELECT 1 FROM json_each(json_extract(r.spec,'$.supplierIds')) WHERE value=?)",
          w.id,
          supplier.id,
        )
      ) {
        const contact = one<{ account: string }>(
          "SELECT account FROM demo_payment_contacts WHERE workspace_id=? AND supplier_id=?",
          w.id,
          supplier.id,
        );
        if (contact?.account !== process.env.PAYPAL_MERCHANT_ID)
          throw new DomainError(
            "Have this demo supplier confirm the configured sandbox merchant ID in their private portal. A spoken detail or email alone is not verified for payment.",
          );
      }
      run(
        "UPDATE suppliers SET merchant_id=?,verification=? WHERE id=?",
        process.env.PAYPAL_MERCHANT_ID,
        "Sandbox merchant mapped",
        supplier.id,
      );
      audit(
        w.id,
        null,
        "supplier",
        `${supplier.company} mapped by the owner to the single configured sandbox test merchant. This is a limited demonstration arrangement.`,
      );
      result = { mapped: true };
    } else if (body.action === "supplier.stopContact") {
      const supplier = requireRecord(
        one<Supplier>(
          "SELECT * FROM suppliers WHERE id=? AND workspace_id=?",
          data.supplierId,
          w.id,
        ),
      );
      run("UPDATE suppliers SET do_not_contact=1 WHERE id=?", supplier.id);
      audit(
        w.id,
        null,
        "supplier",
        `Future outreach disabled for ${supplier.company}.`,
      );
      result = { stopped: true };
    } else if (body.action === "request.note") {
      getRequest(w.id, rid);
      const note = z.string().min(3).max(2000).parse(data.note);
      audit(
        w.id,
        rid,
        "note",
        note + " (recorded internally; no message sent)",
      );
      result = { saved: true };
    } else if (body.action === "job.retry") {
      const job = requireRecord(
        one<Job>(
          "SELECT * FROM jobs WHERE id=? AND workspace_id=?",
          data.jobId,
          w.id,
        ),
      );
      if (job.status !== "failed")
        throw new DomainError("Only failed jobs can be retried.");
      run(
        "UPDATE jobs SET status='queued',error=NULL,run_after=? WHERE id=?",
        now(),
        job.id,
      );
      result = { queued: true };
    } else throw new DomainError("This action is not supported.", 404);
    return NextResponse.json(result || { ok: true });
  } catch (e) {
    return apiError(e);
  }
}
