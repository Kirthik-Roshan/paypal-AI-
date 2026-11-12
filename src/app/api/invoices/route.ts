import { NextResponse } from "next/server";
import { invoicePdf } from "@/lib/invoice-pdf";
import { getAgreement } from "@/lib/domain";
import { one } from "@/lib/db";
import type { Supplier } from "@/lib/types";
import { z } from "zod";
import { apiError } from "@/lib/http";
import { DomainError } from "@/lib/db";
import { session, sameOrigin, rateLimit } from "@/lib/session";
import { invoiceAction, requestInvoice } from "@/lib/providers/invoicing";
export async function GET(request: Request) {
  try {
    const w = await session();
    const url = new URL(request.url);
    const invoice = requestInvoice(
      w,
      z.string().min(1).parse(url.searchParams.get("requestId")),
    );
    if (url.searchParams.get("format") !== "pdf")
      return NextResponse.json(
        { invoice },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    if (!invoice?.snapshot)
      throw new DomainError(
        "Refresh a verified PayPal invoice before downloading.",
      );
    const agreement = getAgreement(w.id, invoice.request_id);
    const supplier = agreement
      ? one<Supplier>(
          "SELECT * FROM suppliers WHERE workspace_id=? AND id=?",
          w.id,
          agreement.supplier_id,
        )
      : null;
    return new NextResponse(
      await invoicePdf(
        invoice,
        w.name,
        supplier?.company || "Configured sandbox merchant",
      ),
      {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const w = await session();
    rateLimit(`invoice:${w.id}`, 20);
    const input = z
      .object({
        requestId: z.string(),
        action: z.enum(["create", "refresh"]),
        email: z.email().optional(),
      })
      .parse(await request.json());
    return NextResponse.json({
      invoice: await invoiceAction(
        w,
        input.requestId,
        input.action,
        input.email,
      ),
    });
  } catch (e) {
    return apiError(e);
  }
}
