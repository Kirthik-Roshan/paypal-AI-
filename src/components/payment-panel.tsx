"use client";
import { date, money } from "@/lib/format";
import type { PurchaseRequest } from "@/lib/types";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useWorkspace } from "./context";
import { Badge, Button, Empty, Field, Modal, Notice, Status } from "./ui";
import { PayPalMark } from "./paypal-brand";
import { PayPalHandoff } from "./paypal-handoff";
export function RequestPayments({ request: r }: { request: PurchaseRequest }) {
  const { data, action } = useWorkspace();
  const params = useSearchParams();
  const [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [refundAmount, setRefundAmount] = useState(""),
    [reason, setReason] = useState(""),
    [refundKey, setRefundKey] = useState("");
  const [handoff, setHandoff] = useState("");
  const a = data.agreements.find((a) => a.request_id === r.id);
  const p = data.payments.find((p) => p.request_id === r.id);
  const supplier = data.suppliers.find((s) => s.id === a?.supplier_id);
  const submission = data.submissions.find((s) => s.request_id === r.id);
  const review = data.reviews.find((v) => v.request_id === r.id);
  const current = !!(
    review?.decision === "accepted" &&
    review.submission_id === submission?.id &&
    review.requirement_version === r.version &&
    submission?.agreement_quote_id === a?.quote_id &&
    !review.findings.some((f) => f.result === "fail")
  );
  if (!a || !p)
    return (
      <section className="panel">
        <Empty
          icon={CreditCard}
          title="An agreement comes before a payment"
          description="Select a written quotation to create a clearly defined stage and payment amount."
        >
          <Link
            href={`/requests/${r.id}?tab=quotes`}
            className="btn btn-primary"
          >
            Compare quotations
            <ArrowRight size={15} />
          </Link>
        </Empty>
      </section>
    );
  const eligible =
    current && a.buyer_accepted === 1 && a.supplier_accepted === 1;
  const sample = data.workspace.mode !== "sandbox";
  const labels: Record<string, string> = {
    create: "Create PayPal authorization order",
    authorize: "Verify buyer approval & authorize",
    capture: "Capture accepted stage",
    void: "Void unused authorization",
    refund: "Issue a refund",
    reconcile: "Retrieve PayPal state",
  };
  const consequences: Record<string, string> = {
    create:
      "Create a sandbox order for this exact stage. The buyer must approve it on PayPal before funds can be authorized.",
    authorize:
      "Retrieve the order directly from PayPal, verify buyer approval, and place a hold on the agreed funds. The supplier will not receive money yet.",
    capture:
      "Collect the full agreed amount from the valid authorization. The supplier receives payment only when PayPal confirms capture.",
    void: "Release an unused authorization. No captured payment will be refunded by this action.",
    refund:
      "Refund against the original capture. Pending refunds remain separate from completed refunds.",
  };
  async function doAction() {
    setBusy(true);
    try {
      const result = await action(
        `payment.${confirm}`,
        r.id,
        confirm === "refund"
          ? { amount: refundAmount, reason, operationKey: refundKey }
          : undefined,
        "PayPal action completed. Review the verified state below.",
      );
      setConfirm("");
      if (result.approvalUrl) setHandoff(result.approvalUrl);
    } catch {
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="payment-workspace">
      <div className="tab-section-heading">
        <div>
          <h2>Funds move when the details are right.</h2>
          <p>
            One buyer-approved order per stage. Authorization and capture are
            separate.
          </p>
        </div>
        <Badge tone="blue">PayPal sandbox</Badge>
      </div>
      {sample && (
        <Notice tone="neutral">
          <strong>
            {data.workspace.mode === "sample"
              ? "Sample walkthrough · no funds authorized or captured."
              : "Connect payments before authorizing funds."}
          </strong>{" "}
          Payments require a connected sandbox, a real supplier merchant and
          buyer approval.{" "}
          <Link href="/settings" className="text-link">
            Set up PayPal
            <ArrowUpRight size={14} />
          </Link>
        </Notice>
      )}
      {params.get("paypal") === "return" && (
        <Notice>
          Returned from PayPal. This redirect does not prove approval or
          payment. Use “Verify buyer approval & authorize” to retrieve provider
          state.
        </Notice>
      )}
      {params.get("paypal") === "cancel" && (
        <Notice>
          Checkout was closed. No successful authorization or capture is
          assumed.
        </Notice>
      )}
      <div className="payment-layout">
        <section className="panel payment-stage">
          <div className="panel-head">
            <div className="section-title">
              <h2>Agreed payment stage</h2>
              <Badge>Stage 1 of 1</Badge>
            </div>
            <Status value={p.status} />
          </div>
          <div className="payment-stage-body">
            <div className="payment-recipient">
              <span className="payment-provider-mark">
                <PayPalMark />
              </span>
              <div>
                <span>PAYABLE TO</span>
                <h3>{supplier?.company}</h3>
                <p>
                  {data.workspace.mode === "sample"
                    ? "Fictional sample supplier"
                    : supplier?.merchant_id
                      ? "Mapped dedicated sandbox merchant"
                      : "Merchant payment setup pending"}
                </p>
              </div>
            </div>
            <div className="stage-amount">
              <span>{a.stage}</span>
              <strong>
                {money(p.amount, p.currency)}
                <small>{p.currency}</small>
              </strong>
              <p>
                Exact agreed total · Requirement version {a.requirement_version}
              </p>
            </div>
            <dl className="detail-grid payment-refs">
              <div>
                <dt>Order reference</dt>
                <dd>{p.order_id || "Not created"}</dd>
              </div>
              <div>
                <dt>Authorization reference</dt>
                <dd>{p.authorization_id || "No funds authorized"}</dd>
              </div>
              <div>
                <dt>Capture reference</dt>
                <dd>{p.capture_id || "No funds captured"}</dd>
              </div>
              <div>
                <dt>Authorization expires</dt>
                <dd>
                  {p.expires_at
                    ? date(p.expires_at, {
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Not applicable"}
                </dd>
              </div>
              <div>
                <dt>Refunded</dt>
                <dd>{money(p.refunded, p.currency)}</dd>
              </div>
              <div>
                <dt>Remaining refundable</dt>
                <dd>
                  {p.capture_id
                    ? money(p.amount - p.refunded, p.currency)
                    : "No captured balance"}
                </dd>
              </div>
            </dl>
            <div className="payment-primary-actions">
              {sample ? (
                <Link href="/settings" className="btn btn-primary">
                  <CreditCard size={16} />
                  Connect PayPal sandbox
                  <ArrowRight size={16} />
                </Link>
              ) : (
                <>
                  {!p.order_id && (
                    <Button
                      disabled={!a.supplier_accepted || !a.buyer_accepted}
                      onClick={() => setConfirm("create")}
                    >
                      <LockKeyhole size={16} />
                      Authorize funds with PayPal
                    </Button>
                  )}
                  {p.approval_url && !p.authorization_id && (
                    <>
                      <Button
                        onClick={() => setHandoff(p.approval_url!)}
                        variant="secondary"
                      >
                        Open buyer approval
                        <ArrowUpRight size={14} />
                      </Button>
                      <Button onClick={() => setConfirm("authorize")}>
                        Verify buyer approval & authorize
                      </Button>
                    </>
                  )}
                  {p.status === "Authorized" && (
                    <>
                      <Button
                        disabled={!eligible}
                        onClick={() => setConfirm("capture")}
                      >
                        <ShieldCheck size={16} />
                        Capture accepted stage
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setConfirm("void")}
                      >
                        Void authorization
                      </Button>
                    </>
                  )}
                  {p.capture_id && p.refunded < p.amount && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setRefundAmount(
                          ((p.amount - p.refunded) / 100).toFixed(2),
                        );
                        setReason("");
                        setRefundKey(crypto.randomUUID());
                        setConfirm("refund");
                      }}
                    >
                      Request refund
                    </Button>
                  )}
                  {p.order_id && (
                    <Button
                      variant="ghost"
                      busy={busy}
                      onClick={() => {
                        setBusy(true);
                        void action(
                          "payment.reconcile",
                          r.id,
                          undefined,
                          "Payment state retrieved from PayPal.",
                        )
                          .catch(() => {})
                          .finally(() => setBusy(false));
                      }}
                    >
                      <RefreshCw size={14} />
                      Refresh provider state
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="payment-honor">
            <ClockIcon />
            <p>
              PayPal authorizations have a 29-day window and an initial
              three-day honor period. This app requires renewed approval after
              that honor period. Funds are not held indefinitely.
            </p>
          </div>
        </section>
        <aside>
          <section className="panel eligibility-card">
            <span
              className={`eligibility-large-icon ${eligible ? "eligible" : ""}`}
            >
              <ShieldCheck size={27} />
            </span>
            <span className="section-kicker">CAPTURE ELIGIBILITY</span>
            <h3>
              {eligible
                ? "Evidence accepted. Ready for your decision."
                : "A few things need to be in place."}
            </h3>
            <div className="eligibility-checklist">
              {[
                {
                  label: "Buyer accepted the current agreement",
                  pass:
                    !!a.buyer_accepted && a.requirement_version === r.version,
                },
                {
                  label: "Supplier accepted the current agreement",
                  pass:
                    !!a.supplier_accepted &&
                    a.requirement_version === r.version,
                },
                { label: "Current evidence accepted by buyer", pass: current },
                {
                  label: "Active PayPal authorization",
                  pass: p.status === "Authorized",
                },
                {
                  label: "Dedicated merchant connected",
                  pass: !!supplier?.merchant_id && !sample,
                },
              ].map((c) => (
                <div key={c.label} className={c.pass ? "text-green" : "muted"}>
                  {c.pass ? (
                    <CheckCircle2 size={17} />
                  ) : (
                    <span className="checklist-circle" />
                  )}
                  <span>{c.label}</span>
                </div>
              ))}
            </div>
            {!current && (
              <Link href={`/requests/${r.id}?tab=review`} className="text-link">
                Review the evidence
                <ArrowRight size={15} />
              </Link>
            )}
            <p className="field-hint">
              Only server-verified records can make a stage eligible. A
              client-side check cannot authorize payment.
            </p>
          </section>
          <div className="scope-card">
            <ShieldCheck size={20} />
            <h3>Approval stays with you.</h3>
            <p>
              Sample documents, analysis results and supplier instructions
              cannot trigger payment. Every financial action requires a separate
              confirmation.
            </p>
          </div>
        </aside>
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Payment event history</h2>
          <span className="muted">Verified provider activity only</span>
        </div>
        <div className="payment-events">
          {data.activity.filter(
            (e) =>
              e.request_id === r.id && ["payment", "refund"].includes(e.type),
          ).length ? (
            data.activity
              .filter(
                (e) =>
                  e.request_id === r.id &&
                  ["payment", "refund"].includes(e.type),
              )
              .map((e) => (
                <div key={e.id}>
                  <span className="activity-icon">
                    <CreditCard size={15} />
                  </span>
                  <p>
                    {e.message}
                    <small>
                      {date(e.created_at, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </p>
                </div>
              ))
          ) : (
            <p>
              No provider payment events. A quote or agreement is not proof of
              payment.
            </p>
          )}
        </div>
      </section>
      {handoff && (
        <PayPalHandoff url={handoff} onClose={() => setHandoff("")} />
      )}
      {confirm && (
        <Modal
          title={labels[confirm]}
          onClose={() => {
            if (!busy) setConfirm("");
          }}
        >
          <div className="financial-summary">
            <span>Supplier · {supplier?.company}</span>
            <strong>
              {money(
                confirm === "refund"
                  ? Math.round(Number(refundAmount) * 100)
                  : p.amount,
                p.currency,
              )}
            </strong>
            <span>
              {a.stage} · Requirement v{a.requirement_version}
            </span>
            <Badge tone="blue">Sandbox transaction</Badge>
          </div>
          <p>{consequences[confirm]}</p>
          {confirm === "refund" && (
            <div className="refund-form">
              <Field
                label={`Refund amount (${p.currency})`}
                hint={`Maximum ${money(p.amount - p.refunded, p.currency)}`}
              >
                <input
                  type="number"
                  min="0.01"
                  max={(p.amount - p.refunded) / 100}
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
              </Field>
              <Field label="Approved refund reason" required>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </Field>
            </div>
          )}
          <Notice tone={confirm === "void" ? "amber" : "neutral"}>
            {confirm === "capture"
              ? "Capture requires an accepted current submission and a valid, unexpired authorization. Duplicate requests are blocked."
              : confirm === "void"
                ? "This releases the hold. A new purchase would require fresh buyer approval."
                : "Amount, currency, merchant and workspace are checked on the server."}
          </Notice>
          <div className="modal-actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirm("")}
            >
              Go back
            </Button>
            <Button
              busy={busy}
              disabled={
                confirm === "refund" &&
                (reason.trim().length < 3 || Number(refundAmount) <= 0)
              }
              onClick={() => void doAction()}
            >
              {confirm === "capture"
                ? "Confirm capture"
                : confirm === "void"
                  ? "Confirm void"
                  : confirm === "refund"
                    ? "Confirm refund"
                    : "Continue with PayPal"}
              <ArrowRight size={15} />
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ClockIcon() {
  return <LockKeyhole size={18} />;
}
