import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { all, requireRecord } from "@/lib/db";
import { demoState } from "@/lib/demo";
import { getAgreement, getRequest } from "@/lib/domain";
import { apiError } from "@/lib/http";
import { session } from "@/lib/session";
import type { Supplier } from "@/lib/types";
export async function GET() {
  try {
    const w = await session(),
      state = requireRecord(demoState(w) || undefined),
      req = getRequest(w.id, state.requestId),
      agreement = requireRecord(getAgreement(w.id, req.id));
    const supplier = requireRecord(
      all<Supplier>(
        "SELECT * FROM suppliers WHERE workspace_id=? AND id=?",
        w.id,
        agreement.supplier_id,
      )[0],
    );
    const doc = await PDFDocument.create();
    let page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    let y = 785;
    const line = (text: string, size = 11) => {
      for (const chunk of text
        .replace(/[^\x20-\x7E]/g, " ")
        .match(/.{1,83}(?:\s|$)|.{1,83}/g) || [""]) {
        if (y < 55) {
          page = doc.addPage([595, 842]);
          y = 785;
        }
        page.drawText(chunk.trim(), {
          x: 48,
          y,
          size,
          font,
          color: rgb(0.09, 0.2, 0.15),
        });
        y -= size + 10;
      }
    };
    line("PROCUREPROOF", 13);
    line("PRO FORMA PURCHASE SUMMARY", 21);
    line("HACKATHON / NOT A TAX INVOICE / NOT PROOF OF PAYMENT", 9);
    y -= 22;
    for (const text of [
      `Request: ${req.code} / requirements v${agreement.requirement_version}`,
      `Generated: ${new Date().toISOString()}`,
      `Buyer: ${state.config.business}`,
      `Deliver to: ${req.spec.destination}`,
      `Supplier: ${supplier.company}`,
      `Product: ${req.spec.description}`,
      `Quantity: ${req.spec.quantity} ${req.spec.unit}`,
      `Pack: ${req.spec.material}`,
      `Delivery deadline: ${req.spec.deadline}`,
      `Agreement: ${agreement.id}`,
      `Stage: ${agreement.stage}`,
      `Agreed amount: ${agreement.currency} ${(agreement.amount / 100).toFixed(2)}`,
      `Supplier accepted: ${agreement.supplier_accepted ? "Yes" : "Not yet"}`,
    ])
      line(text);
    y -= 18;
    line(
      "This buyer-generated document creates no charge and does not certify delivery,",
    );
    line(
      "tax registration, payment recipient identity or a successful PayPal transaction.",
    );
    line(
      "Obtain the supplier-issued invoice separately. PayPal Invoicing is not connected.",
    );
    return new Response(new Uint8Array(await doc.save()), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="restock-pro-forma.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
