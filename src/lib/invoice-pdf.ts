import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { InvoiceRecord } from "./providers/invoicing";

// This is our rendering of verified PayPal data, not an official PayPal export.
export async function invoicePdf(
  invoice: InvoiceRecord,
  buyer: string,
  supplier: string,
  provenance = "Rendered from verified provider data. Not a PayPal-issued PDF or proof of payment.",
) {
  const data = JSON.parse(invoice.snapshot!);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.025, 0.12, 0.27),
    blue = rgb(0, 0.34, 0.72),
    muted = rgb(0.32, 0.39, 0.48),
    pale = rgb(0.94, 0.97, 1),
    border = rgb(0.82, 0.87, 0.93);
  let page = pdf.addPage([595, 842]),
    y = 798;
  const clean = (s: unknown) =>
    String(s ?? "")
      .replace(/×/g, "x")
      .replace(/[–—]/g, "-")
      .replace(/[’‘]/g, "'")
      .replace(/[^\x20-\x7e\n]/g, " ");
  const text = (
    s: unknown,
    x: number,
    top: number,
    size = 10,
    strong = false,
    color = navy,
  ) =>
    page.drawText(clean(s), {
      x,
      y: top,
      size,
      font: strong ? bold : regular,
      color,
    });
  const line = (top: number) =>
    page.drawLine({
      start: { x: 42, y: top },
      end: { x: 553, y: top },
      thickness: 0.7,
      color: border,
    });
  const wrap = (s: unknown, width: number, size = 10, strong = false) => {
    const words = clean(s).split(/\s+/),
      lines: string[] = [];
    let current = "";
    const f = strong ? bold : regular;
    for (const word of words) {
      if (
        f.widthOfTextAtSize((current ? current + " " : "") + word, size) <=
        width
      ) {
        current += (current ? " " : "") + word;
        continue;
      }
      if (current) lines.push(current);
      current = "";
      for (const ch of word) {
        if (f.widthOfTextAtSize(current + ch, size) > width) {
          lines.push(current);
          current = "";
        }
        current += ch;
      }
    }
    if (current) lines.push(current);
    return lines;
  };
  const footer = () => {
    line(76);
    text(
      "ProcureProof  /  PayPal Sandbox invoice record",
      42,
      59,
      8,
      true,
      muted,
    );
    text(
      provenance,
      42,
      45,
      8,
      false,
      muted,
    );
    text(String(pdf.getPageCount()), 541, 45, 8, false, muted);
  };
  const space = (height: number) => {
    if (y - height < 102) {
      footer();
      page = pdf.addPage([595, 842]);
      text("INVOICE / CONTINUED", 42, 795, 15, true);
      text(invoice.invoice_number, 42, 775, 9, false, muted);
      y = 744;
    }
  };
  const block = (
    s: unknown,
    x: number,
    width: number,
    size = 10,
    strong = false,
  ) => {
    const rows = wrap(s, width, size, strong);
    for (const row of rows) {
      space(16);
      text(row, x, y, size, strong);
      y -= 16;
    }
    return rows.length;
  };
  page.drawRectangle({ x: 0, y: 834, width: 595, height: 8, color: blue });
  text("ProcureProof", 42, y, 19, true);
  text("INVOICE", 394, y, 27, true);
  y -= 25;
  text("Supplier billing record", 42, y, 10, false, muted);
  page.drawRectangle({ x: 394, y: y - 6, width: 159, height: 20, color: pale });
  text(`${invoice.status} / SANDBOX`, 404, y + 1, 9, true, blue);
  y -= 42;
  const metadata = [
    ["Invoice number", invoice.invoice_number],
    ["PayPal invoice ID", invoice.provider_id || "Unavailable"],
    ["Invoice date", data.detail?.invoice_date || "Not supplied"],
    ["Reference", data.detail?.reference || "Not supplied"],
  ];
  for (const [label, value] of metadata) {
    text(label, 42, y, 9, false, muted);
    text(value, 165, y, 10, true);
    y -= 20;
  }
  y -= 10;
  line(y);
  y -= 26;
  const partyTop = y;
  text("FROM / SUPPLIER", 42, y, 8, true, blue);
  y -= 20;
  block(data.invoicer?.business_name || supplier, 42, 238, 12, true);
  if (data.invoicer?.email_address)
    block(data.invoicer.email_address, 42, 238, 9);
  const leftBottom = y;
  y = partyTop;
  text("BILL TO / BUYER", 310, y, 8, true, blue);
  y -= 20;
  block(buyer, 310, 243, 12, true);
  block(invoice.recipient_email, 310, 243, 9);
  y = Math.min(y, leftBottom) - 25;
  const tableHead = () => {
    space(34);
    page.drawRectangle({
      x: 42,
      y: y - 12,
      width: 511,
      height: 30,
      color: navy,
    });
    text("DESCRIPTION", 54, y, 9, true, rgb(1, 1, 1));
    text("QTY", 354, y, 9, true, rgb(1, 1, 1));
    text("UNIT AMOUNT", 395, y, 8, true, rgb(1, 1, 1));
    text("CURRENCY", 492, y, 8, true, rgb(1, 1, 1));
    y -= 40;
  };
  tableHead();
  for (const item of data.items || []) {
    const names = wrap(item.name, 281, 10, true),
      details = wrap(item.description || "", 281, 9);
    space(44);
    const rowY = y;
    text(item.quantity, 354, rowY, 10);
    text(item.unit_amount?.value || "Not supplied", 395, rowY, 10);
    text(
      item.unit_amount?.currency_code || data.detail?.currency_code,
      492,
      rowY,
      9,
    );
    for (const row of names) {
      space(16);
      text(row, 54, y, 10, true);
      y -= 16;
    }
    for (const row of details) {
      space(14);
      text(row, 54, y, 9, false, muted);
      y -= 14;
    }
    y -= 14;
    line(y);
    y -= 24;
  }
  space(100);
  page.drawRectangle({
    x: 310,
    y: y - 55,
    width: 243,
    height: 70,
    color: pale,
  });
  text("INVOICE TOTAL", 326, y - 5, 9, true, muted);
  text(
    `${data.amount?.currency_code} ${data.amount?.value}`,
    326,
    y - 35,
    23,
    true,
    blue,
  );
  y -= 90;
  block("PAYMENT & DOCUMENT STATUS", 42, 511, 9, true);
  block(
    invoice.status === "DRAFT"
      ? "Unsent draft. No payment is requested by this document. Payment is collected separately through ProcureProof checkout."
      : "Provider status is shown above. Checkout payment status must be verified separately; this document is not a receipt.",
    42,
    511,
    10,
  );
  y -= 10;
  block(
    "The agreement is billed as one inclusive line. Its description identifies the actual goods and quantity; quoted shipping and tax are included in the agreed total.",
    42,
    511,
    9,
  );
  y -= 10;
  block(`Provider data last verified: ${invoice.updated_at}`, 42, 511, 8);
  footer();
  pdf.setTitle(`Invoice ${invoice.invoice_number}`);
  pdf.setAuthor("ProcureProof");
  return Buffer.from(await pdf.save());
}
