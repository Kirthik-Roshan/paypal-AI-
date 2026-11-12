"use client";
import { useEffect, useState } from "react";
import { Button, Field, Notice } from "./ui";
import type { InvoiceRecord } from "@/lib/providers/invoicing";
export function InvoicePanel({ requestId }: { requestId: string }) {
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/invoices?requestId=${encodeURIComponent(requestId)}`)
      .then(async (r) => {
        const d = await r.json();
        if (active) {
          if (!r.ok) setError(d.error);
          else setInvoice(d.invoice);
        }
      })
      .catch(() => {
        if (active) setError("Unable to load invoice status.");
      });
    return () => {
      active = false;
    };
  }, [requestId]);
  async function submit(action: "create" | "refresh", recipient = email) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          action,
          ...(action === "create" ? { email: recipient } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setInvoice(d.invoice);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invoice request failed.");
      const r = await fetch(
        `/api/invoices?requestId=${encodeURIComponent(requestId)}`,
      ).catch(() => null);
      if (r?.ok) setInvoice((await r.json()).invoice);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>PayPal invoice</h2>
      </div>
      <div className="panel-body">
        <p>
          Create a real PayPal Sandbox draft from the accepted agreement. It
          stays unsent; payment continues through checkout.
        </p>
        {error && <Notice>{error}</Notice>}
        {invoice ? (
          <>
            <p>
              <strong>Status:</strong> {invoice.status} ·{" "}
              {invoice.provider_id ||
                (invoice.status === "rejected"
                  ? "No invoice created"
                  : "Awaiting provider confirmation")}
            </p>
            <p>Bill to: {invoice.recipient_email}</p>
            {invoice.error && <Notice>{invoice.error}</Notice>}
            {invoice.status === "rejected" && (
              <>
                <Notice>
                  Check PayPal Developer → Apps &amp; Credentials → Sandbox →
                  your supplier app → Features. Enable Invoicing if available,
                  then restart the local app to refresh its access token.
                </Notice>
                <Button
                  disabled={busy}
                  onClick={() => {
                    setEmail(invoice.recipient_email);
                    void submit("create", invoice.recipient_email);
                  }}
                >
                  Retry after fixing PayPal access
                </Button>
              </>
            )}
            <Button
              disabled={busy}
              variant="secondary"
              onClick={() => void submit("refresh")}
            >
              {busy ? "Checking…" : "Refresh invoice"}
            </Button>
            {invoice.snapshot && (
              <a
                className="btn btn-secondary"
                href={`/api/invoices?requestId=${encodeURIComponent(requestId)}&format=pdf`}
              >
                Download draft PDF
              </a>
            )}
            <p className="muted">
              View the invoice in the configured merchant’s PayPal Sandbox
              invoicing dashboard. This draft does not prove payment.
            </p>
          </>
        ) : (
          <>
            <Field
              label="Buyer’s invoice email"
              required
              hint="The buyer/customer email, not the supplier merchant email."
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="buyer@example.com"
              />
            </Field>
            <Button
              disabled={busy || !email}
              onClick={() => void submit("create")}
            >
              {busy ? "Creating…" : "Generate PayPal draft invoice"}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
