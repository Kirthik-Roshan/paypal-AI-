import { z } from "zod";
import { audit, db, DomainError, now, one, requireRecord, run } from "../db";
import { getAgreement, getRequest } from "../domain";
import { decimal, minor } from "../money";
import type { Supplier, Workspace } from "../types";
import { paypalFetch, ProviderError, type PaypalTransport } from "./paypal";

export type InvoiceRecord = {
  agreement_id: string;
  workspace_id: string;
  request_id: string;
  invoice_number: string;
  provider_id: string | null;
  recipient_email: string;
  status: string;
  snapshot: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};
export function requestInvoice(w: Workspace, requestId: string) {
  getRequest(w.id, requestId);
  const a = getAgreement(w.id, requestId);
  return a
    ? one<InvoiceRecord>(
        "SELECT * FROM paypal_invoices WHERE workspace_id=? AND agreement_id=?",
        w.id,
        a.id,
      ) || null
    : null;
}
export async function invoiceAction(
  w: Workspace,
  requestId: string,
  action: "create" | "refresh",
  email?: string,
  transport: PaypalTransport = paypalFetch,
) {
  const req = getRequest(w.id, requestId);
  if (w.mode !== "sandbox")
    throw new DomainError(
      "Connect owner sign-in and PayPal Sandbox before creating an invoice.",
      503,
    );
  const a = requireRecord(getAgreement(w.id, requestId));
  const supplier = requireRecord(
    one<Supplier>(
      "SELECT * FROM suppliers WHERE id=? AND workspace_id=?",
      a.supplier_id,
      w.id,
    ),
  );
  if (
    !process.env.PAYPAL_MERCHANT_ID ||
    supplier.merchant_id !== process.env.PAYPAL_MERCHANT_ID
  )
    throw new DomainError(
      "Map the selected supplier to the configured sandbox merchant in Settings first.",
    );
  if (
    !a.buyer_accepted ||
    !a.supplier_accepted ||
    a.requirement_version !== req.version
  )
    throw new DomainError(
      "Both parties must accept the current agreement before invoice generation.",
    );
  const number = `PP-${a.id.replaceAll("-", "").slice(0, 20)}`;
  let row = requestInvoice(w, requestId);
  if (action === "create") {
    if (row?.provider_id) return row;
    if (row && row.status !== "rejected")
      throw new DomainError(
        "An invoice attempt already exists. Refresh PayPal state before creating another invoice.",
        409,
      );
    const recipient = z.email().parse(email);
    const claimed = row
      ? run(
          "UPDATE paypal_invoices SET status='creating',recipient_email=?,error=NULL,updated_at=? WHERE agreement_id=? AND status='rejected' AND provider_id IS NULL",
          recipient,
          now(),
          a.id,
        )
      : run(
          "INSERT OR IGNORE INTO paypal_invoices (agreement_id,workspace_id,request_id,invoice_number,recipient_email,status,created_at,updated_at) VALUES (?,?,?,?,?,'creating',?,?)",
          a.id,
          w.id,
          requestId,
          number,
          recipient,
          now(),
          now(),
        );
    if (!claimed.changes)
      throw new DomainError("Invoice generation is already in progress.", 409);
    try {
      const result = await transport(
        "/v2/invoicing/invoices",
        "POST",
        {
          detail: {
            invoice_number: number,
            currency_code: a.currency,
            reference: req.code,
            note: "Sandbox draft for agreement review only. Payment is collected separately through ProcureProof checkout. This draft has not been sent.",
            payment_term: { term_type: "DUE_ON_RECEIPT" },
          },
          primary_recipients: [{ billing_info: { email_address: recipient } }],
          items: [
            {
              name: req.title.slice(0, 200),
              description:
                `Agreed total for ${req.spec.quantity} ${req.spec.unit}, including all quoted shipping and tax. Requirement version ${req.version}.`.slice(
                  0,
                  1000,
                ),
              quantity: "1",
              unit_amount: {
                currency_code: a.currency,
                value: decimal(a.amount),
              },
              unit_of_measure: "AMOUNT",
            },
          ],
          configuration: {
            allow_tip: false,
            partial_payment: { allow_partial_payment: false },
          },
        },
        a.id,
      );
      let invoiceId = typeof result.id === "string" ? result.id : "";
      if (!invoiceId) {
        const href =
          result.href ||
          result.links?.find((l: { rel: string }) => l.rel === "self")?.href;
        if (typeof href === "string")
          invoiceId =
            href.match(
              /\/v2\/invoicing\/invoices\/(INV2-[A-Z0-9-]+)(?:$|\?)/,
            )?.[1] || "";
      }
      if (!/^INV2-[A-Z0-9-]+$/.test(invoiceId))
        throw new Error("Missing invoice ID");
      run(
        "UPDATE paypal_invoices SET provider_id=?,status='created',updated_at=? WHERE agreement_id=?",
        invoiceId,
        now(),
        a.id,
      );
    } catch (e) {
      run(
        "UPDATE paypal_invoices SET status=?,error=?,updated_at=? WHERE agreement_id=?",
        e instanceof ProviderError && !e.uncertain ? "rejected" : "uncertain",
        "PayPal did not confirm a usable invoice. Refresh or inspect the merchant dashboard before retrying.",
        now(),
        a.id,
      );
      throw e instanceof DomainError
        ? e
        : new DomainError(
            "Invoice creation result is uncertain. Refresh PayPal state before retrying.",
            502,
          );
    }
    row = requestInvoice(w, requestId);
  }
  row = requireRecord(row || undefined);
  if (!row.provider_id) {
    const found = await transport("/v2/invoicing/search-invoices", "POST", {
      invoice_number: row.invoice_number,
      page_size: 100,
    });
    const matches = (found.items || []).filter(
      (i: any) => i.detail?.invoice_number === row!.invoice_number,
    );
    if (matches.length !== 1 || !/^INV2-[A-Z0-9-]+$/.test(matches[0].id))
      throw new DomainError(
        "No unique invoice found yet. Inspect the PayPal sandbox merchant dashboard; generation remains locked.",
        409,
      );
    row.provider_id = matches[0].id;
    run(
      "UPDATE paypal_invoices SET provider_id=? WHERE agreement_id=?",
      row.provider_id,
      a.id,
    );
  }
  const canonical = await transport(
    `/v2/invoicing/invoices/${row.provider_id}`,
  );
  if (
    canonical.id !== row.provider_id ||
    canonical.detail?.invoice_number !== number ||
    canonical.detail?.currency_code !== a.currency ||
    canonical.amount?.currency_code !== a.currency ||
    minor(canonical.amount?.value || "0") !== a.amount ||
    canonical.primary_recipients?.[0]?.billing_info?.email_address?.toLowerCase() !==
      row.recipient_email.toLowerCase()
  )
    throw new DomainError(
      "PayPal invoice does not match the agreement or recipient. Inspect the merchant dashboard.",
      502,
    );
  const status = z.string().min(1).parse(canonical.status);
  db().transaction(() => {
    run(
      "UPDATE paypal_invoices SET status=?,snapshot=?,error=NULL,updated_at=? WHERE agreement_id=?",
      status,
      JSON.stringify(canonical),
      now(),
      a.id,
    );
    audit(
      w.id,
      requestId,
      "invoice",
      `PayPal Sandbox invoice ${row.provider_id} verified: ${status}. Invoice status does not authorize or capture checkout funds.`,
    );
  })();
  return requestInvoice(w, requestId)!;
}
