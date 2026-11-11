import { audit, DomainError, now, one, requireRecord, run } from "@/lib/db";
import {
  acceptAgreement,
  invitationByToken,
  portalData,
  submitQuote,
} from "@/lib/domain";
import { apiError } from "@/lib/http";
import { rateLimit, sameOrigin } from "@/lib/session";
import type { Workspace } from "@/lib/types";
import { upload } from "@/lib/uploads";
import { NextResponse } from "next/server";
import { z } from "zod";
type Context = { params: Promise<{ token: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    return NextResponse.json(portalData((await context.params).token), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const token = (await context.params).token;
    const { inv, supplier } = invitationByToken(token);
    rateLimit(`portal:${inv.id}`, 30);
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      if (form.get("role") === "Supplier submission") {
        const p = portalData(token);
        if (!p.agreement?.supplier_accepted)
          throw new DomainError(
            "Accept your selected agreement before submitting artwork.",
            403,
          );
      }
      const result = await upload(
        requireRecord(
          one<Workspace>(
            "SELECT * FROM workspaces WHERE id=?",
            inv.workspace_id,
          ),
        ),
        form,
        inv.request_id,
      );
      const { run } = await import("@/lib/db");
      run("UPDATE assets SET supplier_id=? WHERE id=?", supplier.id, result.id);
      return NextResponse.json(result);
    }
    const body = await request.json();
    if (body.action === "payment.contact") {
      const account = z
        .string()
        .trim()
        .min(5)
        .max(254)
        .refine(
          (v) => z.email().safeParse(v).success || /^[A-Z0-9]{5,30}$/.test(v),
          "Enter a sandbox business email or merchant ID.",
        )
        .parse(body.account);
      if (
        !one(
          "SELECT request_id FROM demo_sessions WHERE request_id=? AND workspace_id=? UNION ALL SELECT request_id FROM request_intakes WHERE request_id=? AND workspace_id=?",
          inv.request_id,
          inv.workspace_id,
          inv.request_id,
          inv.workspace_id,
        )
      )
        throw new DomainError(
          "This request does not support written payment-contact confirmation.",
        );
      if (
        one(
          "SELECT p.id FROM payments p WHERE p.request_id=? AND p.order_id IS NOT NULL",
          inv.request_id,
        )
      )
        throw new DomainError(
          "A provider order already exists; recipient contact changes are locked.",
        );
      run(
        "INSERT INTO demo_payment_contacts (workspace_id,request_id,supplier_id,account,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(request_id,supplier_id) DO UPDATE SET account=excluded.account,updated_at=excluded.updated_at",
        inv.workspace_id,
        inv.request_id,
        supplier.id,
        account,
        now(),
      );
      audit(
        inv.workspace_id,
        inv.request_id,
        "payment contact",
        `${supplier.company} provided a written sandbox payment contact. This is unverified and cannot redirect funds.`,
      );
      return NextResponse.json({ saved: true });
    }
    if (body.action === "agree")
      return NextResponse.json(acceptAgreement(token));
    if (body.action === "question") {
      const note = z.string().min(3).max(2000).parse(body.note);
      audit(
        inv.workspace_id,
        inv.request_id,
        "supplier question",
        `${supplier.company}: ${note}`,
      );
      return NextResponse.json({ saved: true });
    }
    return NextResponse.json(submitQuote(token, body));
  } catch (e) {
    return apiError(e);
  }
}
