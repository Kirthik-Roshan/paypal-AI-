import { createHash } from "node:crypto";
import { PDFDocument, degrees, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { audit, db, id, insert, now, one } from "./db";
import { futureDate } from "./format";
import { pdfPreview } from "./pdf";
import type { RequestSpec, Workspace } from "./types";

export const baseSpec = (): RequestSpec => ({
  description: "",
  quantity: 500,
  unit: "pieces",
  dimensions: "",
  material: "",
  colour: "",
  exactText: "",
  requiredElement: "",
  visualNotes: "",
  deadline: futureDate(21),
  currency: "USD",
  budget: 150000,
  destination: "",
  taxIncluded: true,
  shippingIncluded: true,
  alternatives: "",
  supplierIds: [],
  discover: false,
  region: "",
  maxContacts: 3,
  language: "English",
  channel: "Email",
  outreachStart: "09:00",
  outreachEnd: "17:00",
  timezone: "Asia/Kolkata",
  negotiable: "Unit price only; stay within total budget.",
  askOwner: "Any specification, quantity, currency, or deadline change.",
});
export function artworkSvg(phone: string, element: boolean) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 470"><rect width="620" height="470" fill="#f5f0e6"/><path d="M90 115h440v240H90z" fill="#e7d6b9" stroke="#c6b393" stroke-width="1.5"/><path d="m90 115 48-43h344l48 43M90 355l48 32h344l48-32" fill="#dac4a0" stroke="#c6b393"/><path d="M138 72v315M482 72v315" fill="none" stroke="#c6b393" stroke-dasharray="4 4"/><g fill="#274e3e" text-anchor="middle" font-family="Georgia,serif"><text x="310" y="212" font-size="37" letter-spacing="3">JUNIPER</text><text x="310" y="240" font-family="Arial,sans-serif" font-size="11" letter-spacing="4">COFFEE &amp; GOOD COMPANY</text><path d="M273 258h74" stroke="#274e3e"/><text x="310" y="287" font-size="14" font-family="Arial,sans-serif">${phone}</text>${element ? '<g transform="translate(310 158)" fill="none" stroke="#274e3e" stroke-width="2"><path d="M0 10V-23M0-10q-22-23-24-3 6 15 24 9M0-16q23-20 25-1-7 14-25 8"/></g><text x="310" y="324" font-family="Arial,sans-serif" font-size="10" letter-spacing="2">PLEASE RECYCLE</text>' : ""}</g><text x="310" y="435" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="#7d786d">ORIGINAL SAMPLE ARTWORK · NOT A PRODUCTION PROOF</text></svg>`;
}
export async function examplePdf(
  kind: "correct" | "wrong-phone" | "missing-element" | "reference",
) {
  const phone = kind === "wrong-phone" ? "202-555-0199" : "202-555-0147";
  const element = kind !== "missing-element";
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const page = pdf.addPage([620, 470]);
  const font = await pdf.embedFont(
    readFileSync(
      path.join(process.cwd(), "assets/fonts/LiberationSans-Regular.ttf"),
    ),
    { subset: true },
  );
  const serif = await pdf.embedFont(
    readFileSync(
      path.join(process.cwd(), "assets/fonts/LiberationSerif-Regular.ttf"),
    ),
    { subset: true },
  );
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 620,
    height: 470,
    color: rgb(0.96, 0.94, 0.9),
  });
  page.drawRectangle({
    x: 90,
    y: 115,
    width: 440,
    height: 240,
    color: rgb(0.9, 0.84, 0.73),
    borderColor: rgb(0.77, 0.7, 0.57),
    borderWidth: 1,
  });
  const text = (t: string, x: number, y: number, size = 12) =>
    page.drawText(t, { x, y, size, font, color: rgb(0.15, 0.3, 0.24) });
  page.drawText("JUNIPER", {
    x: 214,
    y: 265,
    size: 36,
    font: serif,
    color: rgb(0.15, 0.3, 0.24),
  });
  text("COFFEE & GOOD COMPANY", 219, 240, 12);
  text(phone, 269, 208, 14);
  if (element) {
    text("PLEASE RECYCLE", 267, 175, 10);
    page.drawLine({
      start: { x: 310, y: 302 },
      end: { x: 310, y: 333 },
      color: rgb(0.15, 0.3, 0.24),
      thickness: 1.4,
    });
    page.drawEllipse({
      x: 301,
      y: 318,
      xScale: 10,
      yScale: 4,
      rotate: degrees(-30),
      color: rgb(0.15, 0.3, 0.24),
    });
    page.drawEllipse({
      x: 319,
      y: 326,
      xScale: 10,
      yScale: 4,
      rotate: degrees(30),
      color: rgb(0.15, 0.3, 0.24),
    });
  }
  text("Document specifications: 200 x 120 x 80 mm", 90, 90, 11);
  text("Quantity: 500 pieces", 90, 70, 11);
  text("Example artwork - not a production proof", 196, 35, 10);
  pdf.setTitle(`Juniper sample - ${kind}`);
  const bytes = Buffer.from(await pdf.save());
  return { bytes, preview: await pdfPreview(bytes) };
}
export async function seedWorkspace(workspaceId: string) {
  if (one<Workspace>("SELECT * FROM workspaces WHERE id=?", workspaceId))
    return;
  const correct = await examplePdf("reference");
  const wrong = await examplePdf("wrong-phone");
  const supplierIds = [id(), id(), id()];
  const requestIds = [id(), id(), id(), id()];
  const referenceId = id(),
    submissionId = id(),
    agreementId = id();
  const spec: RequestSpec = {
    ...baseSpec(),
    description:
      "500 custom kraft takeaway boxes with our Juniper identity. Food-safe stock, one-colour forest green print, and the exact contact number.",
    dimensions: "200 x 120 x 80 mm",
    material: "Food-safe recycled kraft, 350 gsm",
    colour: "Forest green on natural kraft",
    exactText: "202-555-0147",
    requiredElement: "PLEASE RECYCLE",
    visualNotes:
      "Juniper wordmark and leaf emblem. Warm, natural finish; reference background is not a requirement.",
    destination: "Portland, Oregon, United States",
    region: "United States",
    supplierIds,
    discover: true,
  };
  db().transaction(() => {
    insert("workspaces", {
      id: workspaceId,
      name: "Juniper Coffee Studio",
      mode: "sample",
      timezone: "Asia/Kolkata",
      created_at: now(),
    });
    ["Evergreen Packaging", "Paper & Form", "Northline Print Co."].forEach(
      (company, i) =>
        insert("suppliers", {
          id: supplierIds[i],
          workspace_id: workspaceId,
          company,
          contact: ["Jamie Chen", "Alex Morgan", "Taylor Reed"][i],
          email: `quotes@${["evergreen", "paperform", "northline"][i]}.example`,
          phone: "",
          location: ["Portland, OR", "Seattle, WA", "Austin, TX"][i],
          category: "Custom packaging",
          language: "English",
          channel: "Email",
          website: "",
          notes:
            "Fictional supplier for the sample walkthrough. No previous orders.",
          relationship: i === 2 ? "Newly discovered" : "Regular",
          verification: "Unknown",
          merchant_id: "",
          do_not_contact: 0,
          created_at: now(),
        }),
    );
    [
      "Branded takeaway boxes",
      "Seasonal coffee labels",
      "Canvas tote bags",
      "Loyalty cards",
    ].forEach((title, i) => {
      const s =
        i === 0
          ? spec
          : {
              ...baseSpec(),
              quantity: [500, 1200, 100, 500][i],
              description: title,
              destination: "Portland, Oregon, United States",
              deadline: futureDate([18, 12, 28, 24][i]),
              budget: [150000, 42000, 90000, 26000][i],
            };
      insert("requests", {
        id: requestIds[i],
        workspace_id: workspaceId,
        code: `PP-${1042 + i}`,
        title,
        category: [
          "Custom packaging",
          "Printed labels",
          "Branded merchandise",
          "Printed stationery",
        ][i],
        status:
          i === 0
            ? "Needs your review"
            : i === 1
              ? "Comparing quotes"
              : i === 2
                ? "Waiting for supplier"
                : "Draft",
        version: i === 3 ? 0 : 1,
        spec: JSON.stringify(s),
        created_at: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
        updated_at: now(),
      });
      if (i !== 3)
        insert("requirement_versions", {
          id: id(),
          workspace_id: workspaceId,
          request_id: requestIds[i],
          version: 1,
          spec: JSON.stringify(s),
          asset_ids: JSON.stringify(i === 0 ? [referenceId] : []),
          created_at: now(),
        });
    });
    const addAsset = (
      assetId: string,
      name: string,
      role: string,
      file: { bytes: Buffer; preview: string | null },
    ) =>
      insert("assets", {
        id: assetId,
        workspace_id: workspaceId,
        request_id: requestIds[0],
        name,
        mime: "application/pdf",
        role,
        size: file.bytes.length,
        sha256: createHash("sha256").update(file.bytes).digest("hex"),
        content: file.bytes,
        preview: file.preview,
        created_at: now(),
      });
    addAsset(
      referenceId,
      "Juniper-approved-artwork.pdf",
      "Required artwork",
      correct,
    );
    addAsset(
      submissionId,
      "Evergreen-proof-v1.pdf",
      "Supplier submission",
      wrong,
    );
    const quoteIds = [id(), id(), id()];
    quoteIds.forEach((qid, i) =>
      insert("quotes", {
        id: qid,
        workspace_id: workspaceId,
        request_id: requestIds[0],
        supplier_id: supplierIds[i],
        invitation_id: "",
        version: 1,
        requirement_version: 1,
        currency: "USD",
        unit_price: [210, 195, 188][i],
        quantity: 500,
        subtotal: [105000, 97500, 94000][i],
        shipping: [4500, 8500, 6500][i],
        tax: i === 2 ? null : [8400, 7800][i],
        total: i === 2 ? null : [117900, 113800][i],
        completion_date: futureDate(i === 1 ? 26 : 14),
        valid_until: futureDate(10),
        payment_terms:
          "Full payment after artwork approval; separate buyer approval required.",
        exclusions:
          i === 2
            ? "Tax not yet specified."
            : i === 1
              ? "Delivery after the requested deadline."
              : "No known exclusions. Written quotation confirmed.",
        confirmed: 1,
        meets_requirements: 1,
        declined: 0,
        created_at: now(),
      }),
    );
    insert("agreements", {
      id: agreementId,
      workspace_id: workspaceId,
      request_id: requestIds[0],
      supplier_id: supplierIds[0],
      quote_id: quoteIds[0],
      requirement_version: 1,
      amount: 117900,
      currency: "USD",
      stage: "Artwork approval & production",
      buyer_accepted: 1,
      supplier_accepted: 1,
      asset_ids: JSON.stringify([referenceId]),
      created_at: now(),
    });
    insert("submissions", {
      id: id(),
      workspace_id: workspaceId,
      request_id: requestIds[0],
      agreement_id: agreementId,
      agreement_quote_id: quoteIds[0],
      requirement_version: 1,
      asset_id: submissionId,
      version: 1,
      created_at: now(),
    });
    insert("payments", {
      id: id(),
      workspace_id: workspaceId,
      request_id: requestIds[0],
      agreement_id: agreementId,
      order_id: null,
      authorization_id: null,
      capture_id: null,
      status: "Not started",
      amount: 117900,
      currency: "USD",
      refunded: 0,
      authorized_at: null,
      expires_at: null,
      approval_url: null,
      updated_at: now(),
    });
    insert("calls", {
      id: id(),
      workspace_id: workspaceId,
      request_id: requestIds[0],
      supplier_id: supplierIds[0],
      provider_id: null,
      status: "Completed",
      transcript:
        "[SAMPLE TRANSCRIPT — fictional conversation]\nAssistant: I am an AI purchasing assistant for Juniper Coffee Studio. Could you quote 500 printed kraft boxes?\nSupplier: The unit price is $2.10, shipping $45, and tax $84. We can deliver in 14 days.\nAssistant: To confirm: $1,179 total, including shipping and tax. Please submit a written quote through your invitation. This conversation is not an order commitment.\nSupplier: Yes, confirmed. Please send the artwork after selection.",
      facts: JSON.stringify([
        {
          label: "Unit price",
          value: "$2.10",
          evidence: "The unit price is $2.10",
        },
        {
          label: "Written confirmation",
          value: "Sample quotation on file",
          evidence: "Please submit a written quote",
        },
      ]),
      error: null,
      created_at: now(),
      updated_at: now(),
    });
    audit(
      workspaceId,
      requestIds[0],
      "submission",
      "Evergreen Packaging submitted artwork version 1.",
    );
    audit(
      workspaceId,
      requestIds[0],
      "agreement",
      "Sample agreement confirmed for $1,179.00 USD. No funds authorized.",
    );
    audit(
      workspaceId,
      requestIds[0],
      "quote",
      "Three sample written quotations added for comparison.",
    );
    audit(
      workspaceId,
      null,
      "workspace",
      "Sample workspace created. All businesses and quotations are fictional.",
    );
  })();
}
