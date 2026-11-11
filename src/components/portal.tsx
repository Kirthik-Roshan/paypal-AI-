"use client";
import { date, futureDate, money } from "@/lib/format";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  FileText,
  LoaderCircle,
  LockKeyhole,
  MessageSquare,
  Package,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { jsonFetch } from "./context";
import { Badge, Button, Field, Logo, Modal, Notice } from "./ui";
type PortalData = {
  title: string;
  code: string;
  version: number;
  buyer: string;
  sample: boolean;
  supplier: { company: string };
  requirements: Record<string, any>;
  assets: { id: string; name: string; role: string }[];
  quotes: any[];
  agreement: {
    id: string;
    amount: number;
    currency: string;
    stage: string;
    requirement_version: number;
    supplier_accepted: number;
  } | null;
  expires: string;
  demo?: boolean;
  paymentContact?: string;
};
export function SupplierPortal({ token }: { token: string }) {
  const [data, setData] = useState<PortalData | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [success, setSuccess] = useState(""),
    [question, setQuestion] = useState(""),
    [asking, setAsking] = useState(false),
    [agree, setAgree] = useState(false),
    [decline, setDecline] = useState(false);
  const [form, setForm] = useState({
    currency: "USD",
    unitPrice: "",
    quantity: 500,
    shipping: "",
    tax: "",
    completionDate: futureDate(14),
    validUntil: futureDate(7),
    paymentTerms: "",
    exclusions: "",
    meetsRequirements: false,
  });
  const [paymentContact, setPaymentContact] = useState("");
  const [contactError, setContactError] = useState("");
  const file = useRef<HTMLInputElement>(null),
    proof = useRef<HTMLInputElement>(null);
  const endpoint = `/api/portal/${token}`;
  const load = useCallback(async () => {
    const d = await jsonFetch(endpoint);
    setData(d);
    return d as PortalData;
  }, [endpoint]);
  useEffect(() => {
    void load()
      .then((d) => {
        setPaymentContact(d.paymentContact || "");
        const q = d.quotes[0];
        setForm((f) => ({
          ...f,
          quantity: d.requirements.quantity,
          ...(q
            ? {
                currency: q.currency,
                unitPrice: (q.unit_price / 100).toFixed(2),
                quantity: q.quantity,
                shipping:
                  q.shipping === null ? "" : (q.shipping / 100).toFixed(2),
                tax: q.tax === null ? "" : (q.tax / 100).toFixed(2),
                completionDate: q.completion_date,
                validUntil: q.valid_until,
                paymentTerms: q.payment_terms,
                exclusions: q.exclusions,
                meetsRequirements: !!q.meets_requirements,
              }
            : {}),
        }));
      })
      .catch((e) => setError((e as Error).message));
  }, [load]);
  const update = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));
  async function send(declined = false) {
    setBusy("quote");
    setError("");
    setSuccess("");
    try {
      const result = await jsonFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          unitPrice: form.unitPrice || "0",
          shipping: form.shipping,
          tax: form.tax,
          paymentTerms: form.paymentTerms || "Supplier declined",
          decline: declined,
        }),
      });
      await load();
      setDecline(false);
      setSuccess(
        declined
          ? "Your decline has been recorded. Thank you for letting the buyer know."
          : `Written quote version ${result.version} submitted. The buyer can now review your offer.`,
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function uploadFile(selected: File | undefined, role: string) {
    if (!selected) return;
    setBusy(role);
    setError("");
    const f = new FormData();
    f.set("file", selected);
    f.set("role", role);
    try {
      await jsonFetch(endpoint, { method: "POST", body: f });
      setSuccess(
        role === "Supplier submission"
          ? "New evidence submitted for your agreed stage. Earlier acceptance no longer applies."
          : "Quotation PDF uploaded for the buyer. Submit the written offer fields below as well.",
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      if (file.current) file.current.value = "";
      if (proof.current) proof.current.value = "";
    }
  }
  async function accept() {
    setBusy("agree");
    try {
      await jsonFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "agree" }),
      });
      await load();
      setSuccess(
        "Agreement accepted. You can now submit evidence for this stage.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  if (!data)
    return (
      <div className="portal-page">
        <header className="portal-header">
          <Logo />
        </header>
        <main className="portal-main">
          {error ? (
            <div className="panel portal-error">
              <LockKeyhole size={30} />
              <h1>This private invitation isn’t available.</h1>
              <p>{error}</p>
              <p>
                Ask the buyer for a fresh link. Other requests and supplier
                offers remain private.
              </p>
            </div>
          ) : (
            <div className="portal-loading">
              <LoaderCircle className="spin" />
              Opening your private invitation…
            </div>
          )}
        </main>
      </div>
    );
  const req = data.requirements;
  const sub = Math.round(Number(form.unitPrice) * 100) * form.quantity;
  const total =
    form.shipping !== "" && form.tax !== "" && form.unitPrice !== ""
      ? sub +
        Math.round(Number(form.shipping) * 100) +
        Math.round(Number(form.tax) * 100)
      : null;
  return (
    <div className="portal-page">
      <header className="portal-header">
        <Logo />
        <span>
          <LockKeyhole size={13} />
          Private supplier invitation
        </span>
      </header>
      <main className="portal-main">
        <div className="portal-eyebrow">
          A REQUEST FROM {data.buyer.toUpperCase()}
        </div>
        <h1>
          Good work starts
          <br className="portal-break" /> with a clear brief
          <span className="heading-dot">.</span>
        </h1>
        <p className="portal-welcome">
          Hello, {data.supplier.company}. Here’s what the buyer needs. Share a
          written quote, ask a question, or let them know you’re unavailable.
        </p>
        <div className="portal-meta">
          <Badge tone="green">{data.code}</Badge>
          <span>Requirements v{data.version}</span>
          <span>
            <Clock3 size={14} />
            Link expires {date(data.expires)}
          </span>
        </div>
        {data.sample && (
          <Notice tone="neutral">
            Sample walkthrough · fictional buyer and supplier. No messages,
            calls or payments are simulated.
          </Notice>
        )}
        {success && (
          <Notice tone="green">
            <span role="status">{success}</span>
          </Notice>
        )}
        {error && (
          <Notice tone="red">
            <span role="alert">{error}</span>
          </Notice>
        )}
        <section className="panel portal-brief">
          <div className="panel-head">
            <div className="section-title">
              <Package size={19} />
              <h2>{data.title}</h2>
            </div>
            <span>
              {req.quantity.toLocaleString()} {req.unit}
            </span>
          </div>
          <div className="panel-body">
            <p>{req.description}</p>
            <dl className="detail-grid">
              {data.demo ? (
                <>
                  <div>
                    <dt>Pack size</dt>
                    <dd>{req.material || "Ask the buyer"}</dd>
                  </div>
                  <div>
                    <dt>Stock condition</dt>
                    <dd>
                      Sealed cases; brand, flavours and expiry dates confirmed
                      in writing.
                    </dd>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <dt>Dimensions</dt>
                    <dd>{req.dimensions || "Ask the buyer"}</dd>
                  </div>
                  <div>
                    <dt>Material / colour</dt>
                    <dd>
                      {req.material || "Not specified"} /{" "}
                      {req.colour || "Not specified"}
                    </dd>
                  </div>
                  <div>
                    <dt>Exact printed text</dt>
                    <dd className="exact-text">
                      {req.exactText || "Not specified"}
                    </dd>
                  </div>
                  <div>
                    <dt>Required wording / element</dt>
                    <dd>{req.requiredElement || "Not specified"}</dd>
                  </div>
                </>
              )}
              <div>
                <dt>Needed by</dt>
                <dd>{date(req.deadline, { year: "numeric" })}</dd>
              </div>
              <div>
                <dt>Deliver to</dt>
                <dd>{req.destination}</dd>
              </div>
            </dl>
            {req.visualNotes && (
              <div className="note-box">
                <strong>
                  {data.demo
                    ? "Delivery inspection requirements"
                    : "Visual requirements"}
                </strong>
                <p>{req.visualNotes}</p>
              </div>
            )}
            {req.alternatives && (
              <p className="muted">Allowed alternatives: {req.alternatives}</p>
            )}
            {data.assets.length > 0 && (
              <div className="portal-files">
                {data.assets.map((a) => (
                  <a
                    key={a.id}
                    href={`/api/assets/${a.id}?token=${token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileText size={17} />
                    <span>
                      {a.name}
                      <small>{a.role}</small>
                    </span>
                    <ArrowUpRight size={15} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
        {data.demo && (
          <section className="panel">
            <div className="panel-head">
              <h2>Sandbox payment contact</h2>
              <Badge tone="amber">Unverified until buyer checks</Badge>
            </div>
            <form
              className="panel-body"
              onSubmit={(e) => {
                e.preventDefault();
                setBusy("payment-contact");
                setError("");
                setSuccess("");
                setContactError("");
                void jsonFetch(endpoint, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "payment.contact",
                    account: paymentContact,
                  }),
                })
                  .then(() => {
                    setData((current) =>
                      current
                        ? { ...current, paymentContact: paymentContact.trim() }
                        : current,
                    );
                    setSuccess(
                      "Sandbox contact recorded in writing. No payment was created or redirected.",
                    );
                  })
                  .catch((e) => setContactError(e.message))
                  .finally(() => setBusy(""));
              }}
            >
              <Field
                label="Sandbox business email or merchant ID"
                hint="Confirm the detail you provided on the call. Never enter passwords, OTPs or card details."
              >
                <input
                  required
                  disabled={busy === "payment-contact"}
                  maxLength={254}
                  value={paymentContact}
                  onChange={(e) => {
                    setPaymentContact(e.target.value);
                    setContactError("");
                  }}
                />
              </Field>
              <p className="muted">
                Only the configured sandbox merchant can receive checkout funds.
                The buyer must verify your merchant ID separately; email alone
                does not enable a payout.
              </p>
              <Button type="submit" busy={busy === "payment-contact"}>
                Confirm sandbox contact
              </Button>
              {contactError && (
                <div role="alert" className="form-error">
                  {contactError}
                </div>
              )}
              {data.paymentContact &&
                paymentContact.trim() === data.paymentContact && (
                  <div role="status" className="note-box">
                    <strong>Sandbox contact saved.</strong>
                    <p>
                      The buyer still needs to verify the recipient. Next,
                      complete and submit your written quotation below. Saving
                      this contact does not submit a quote or accept an
                      agreement.
                    </p>
                    <a className="text-link" href="#written-quotation">
                      Continue to written quotation ↓
                    </a>
                  </div>
                )}
            </form>
          </section>
        )}
        {data.agreement && (
          <section className="panel portal-agreement">
            <div className="panel-head">
              <div className="section-title">
                <ShieldCheck size={20} />
                <h2>Your selected agreement</h2>
              </div>
              <Badge
                tone={data.agreement.supplier_accepted ? "green" : "amber"}
              >
                {data.agreement.supplier_accepted
                  ? "Accepted"
                  : "Acceptance required"}
              </Badge>
            </div>
            <div className="panel-body">
              <div className="portal-agreement-amount">
                <div>
                  <h3>{data.agreement.stage}</h3>
                  <p>
                    Requirements v{data.agreement.requirement_version} · all
                    approved files above
                  </p>
                </div>
                <strong>
                  {money(data.agreement.amount, data.agreement.currency)}
                </strong>
              </div>
              {!data.agreement.supplier_accepted ? (
                <>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={agree}
                      onChange={(e) => setAgree(e.target.checked)}
                    />
                    <span>
                      I agree to this exact amount, stage and requirement
                      version, including the approved files and quoted delivery
                      terms.
                    </span>
                  </label>
                  <Button
                    disabled={!agree}
                    busy={busy === "agree"}
                    onClick={() => void accept()}
                  >
                    Accept agreement
                    <Check size={16} />
                  </Button>
                </>
              ) : (
                <>
                  <Notice tone="green">
                    Both parties have accepted this stage. Upload your artwork
                    or document evidence below. The buyer reviews it before a
                    separate payment decision.
                  </Notice>
                  <input
                    ref={proof}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    className="sr-only"
                    aria-label="Upload stage evidence"
                    onChange={(e) =>
                      void uploadFile(
                        e.target.files?.[0],
                        "Supplier submission",
                      )
                    }
                  />
                  <Button
                    variant="secondary"
                    busy={busy === "Supplier submission"}
                    onClick={() => proof.current?.click()}
                  >
                    <Upload size={16} />
                    Submit stage artwork / evidence
                  </Button>
                </>
              )}
            </div>
          </section>
        )}
        <section className="panel portal-quote" id="written-quotation">
          <div className="panel-head">
            <div>
              <h2>
                {data.quotes.length
                  ? "Submit a revised quotation"
                  : "Your written quotation"}
              </h2>
              <p className="muted">
                Be explicit about what’s included. Unknown costs will remain
                unknown.
              </p>
            </div>
            {data.quotes.length > 0 && (
              <Badge>Latest v{data.quotes[0].version}</Badge>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <div className="panel-body form-grid">
              <Field label="Currency">
                <select
                  value={form.currency}
                  onChange={(e) => update("currency", e.target.value)}
                >
                  {["USD", "INR", "EUR", "GBP", "AUD", "CAD"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Quantity / minimum quantity" required>
                <input
                  type="number"
                  min={1}
                  max={1000000}
                  required
                  value={form.quantity}
                  onChange={(e) => update("quantity", Number(e.target.value))}
                />
              </Field>
              <Field label="Unit price" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.unitPrice}
                  placeholder="0.00"
                  onChange={(e) => update("unitPrice", e.target.value)}
                />
              </Field>
              <Field
                label="Shipping / delivery"
                hint="Enter 0 only if shipping is confirmed free."
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.shipping}
                  placeholder="Not specified"
                  onChange={(e) => update("shipping", e.target.value)}
                />
              </Field>
              <Field
                label="Tax"
                hint="Leave blank if tax still needs confirmation."
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.tax}
                  placeholder="Not specified"
                  onChange={(e) => update("tax", e.target.value)}
                />
              </Field>
              <Field label="Completion / delivery date" required>
                <input
                  type="date"
                  required
                  value={form.completionDate}
                  onChange={(e) => update("completionDate", e.target.value)}
                />
              </Field>
              <Field label="Quote valid until" required>
                <input
                  type="date"
                  required
                  value={form.validUntil}
                  onChange={(e) => update("validUntil", e.target.value)}
                />
              </Field>
              <div className="form-full">
                <Field label="Payment terms" required>
                  <textarea
                    required
                    value={form.paymentTerms}
                    minLength={3}
                    onChange={(e) => update("paymentTerms", e.target.value)}
                    rows={3}
                    placeholder="When is payment due, and what does the agreed stage cover?"
                  />
                </Field>
              </div>
              <div className="form-full">
                <Field label="Exclusions, exceptions or alternatives">
                  <textarea
                    value={form.exclusions}
                    onChange={(e) => update("exclusions", e.target.value)}
                    rows={3}
                    placeholder="List any unquoted costs or requirements you cannot meet."
                  />
                </Field>
              </div>
              <div className="form-full">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.meetsRequirements}
                    onChange={(e) =>
                      update("meetsRequirements", e.target.checked)
                    }
                  />
                  <span>
                    {data.demo
                      ? "I can meet the confirmed drinks, pack size, quantity, delivery and sealed-stock requirements."
                      : "I can meet the confirmed requirements, including exact printed text, dimensions and required elements."}
                  </span>
                </label>
              </div>
              <div className="form-full">
                <input
                  type="file"
                  ref={file}
                  accept=".pdf"
                  className="sr-only"
                  aria-label="Upload quotation PDF"
                  onChange={(e) =>
                    void uploadFile(e.target.files?.[0], "Quotation PDF")
                  }
                />
                <Button
                  variant="secondary"
                  type="button"
                  busy={busy === "Quotation PDF"}
                  onClick={() => file.current?.click()}
                >
                  <Upload size={15} />
                  Attach quotation PDF
                </Button>
              </div>
            </div>
            <div className="portal-quote-total">
              <div>
                <span>Preview total</span>
                <strong>{money(total, form.currency)}</strong>
                <small>
                  {total === null
                    ? "Add known shipping and tax for a complete total."
                    : "The server recalculates and validates this total on submission."}
                </small>
              </div>
              <Button type="submit" busy={busy === "quote"}>
                Submit {data.quotes.length ? "revision" : "written quote"}
                <ArrowRight size={16} />
              </Button>
            </div>
          </form>
        </section>
        <div className="portal-bottom-actions">
          <button className="text-link" onClick={() => setAsking(true)}>
            <MessageSquare size={16} />
            Ask the buyer a question
          </button>
          <button
            className="text-link subtle-link"
            onClick={() => setDecline(true)}
          >
            Unable to quote this request
          </button>
        </div>
        <footer className="portal-footer">
          <Logo compact />
          <span>
            Only your request and quotation are visible here.
            <br />
            Competing offers and buyer budget stay private.
          </span>
          <LockKeyhole size={15} />
        </footer>
      </main>
      {asking && (
        <Modal title="Ask the buyer" onClose={() => setAsking(false)}>
          <Field label="Your question">
            <textarea
              rows={4}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              autoFocus
            />
          </Field>
          <p className="field-hint">
            Saved in the buyer’s request history. No email is sent
            automatically.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button
              disabled={question.trim().length < 3}
              busy={busy === "question"}
              onClick={() => {
                setBusy("question");
                void jsonFetch(endpoint, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "question", note: question }),
                })
                  .then(() => {
                    setAsking(false);
                    setSuccess(
                      "Your question is saved in the buyer’s request.",
                    );
                  })
                  .catch((e) => setError((e as Error).message))
                  .finally(() => setBusy(""));
              }}
            >
              Submit question
            </Button>
          </div>
        </Modal>
      )}
      {decline && (
        <Modal
          title="Decline this quotation request?"
          onClose={() => setDecline(false)}
        >
          <p>
            The buyer will see that you’re unable to quote. Your earlier written
            versions remain in the request history.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setDecline(false)}>
              Go back
            </Button>
            <Button
              variant="danger"
              busy={busy === "quote"}
              onClick={() => void send(true)}
            >
              Confirm decline
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
