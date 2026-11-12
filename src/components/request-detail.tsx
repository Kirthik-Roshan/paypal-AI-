"use client";
import { date, money } from "@/lib/format";
import { quoteProblems } from "@/lib/quote-rules";
import type { PurchaseRequest, Quote, Supplier } from "@/lib/types";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Copy,
  FileText,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Pencil,
  Phone,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useWorkspace } from "./context";
import { ActivityList } from "./overview";
import { RequestPayments } from "./payment-panel";
import { EvidenceReview } from "./review-panel";
import {
  Badge,
  Button,
  Empty,
  Field,
  FileIcon,
  Modal,
  Notice,
  Status,
} from "./ui";
const QuoteGrid = dynamic(() => import("./quote-grid"), {
  ssr: false,
  loading: () => <div className="skeleton skeleton-grid-loading" />,
});
const tabs = [
  { id: "summary", label: "Summary" },
  { id: "suppliers", label: "Suppliers & calls" },
  { id: "quotes", label: "Quotes" },
  { id: "review", label: "Files & review" },
  { id: "payments", label: "Payments" },
  { id: "history", label: "History" },
];
export function RequestDetail({ requestId }: { requestId: string }) {
  const { data, action } = useWorkspace();
  const params = useSearchParams();
  const requestedTab = params.get("tab") || "summary";
  const tab = tabs.some((t) => t.id === requestedTab)
    ? requestedTab
    : "summary";
  const r = data.requests.find((r) => r.id === requestId);
  const [revision, setRevision] = useState(false),
    [busy, setBusy] = useState(false);
  if (!r)
    return (
      <Empty
        title="Request not found"
        description="This request is not available in your workspace."
      >
        <Link href="/requests" className="btn btn-primary">
          Back to requests
        </Link>
      </Empty>
    );
  const quotes = data.quotes.filter((q) => q.request_id === r.id);
  const agreement = data.agreements.find((a) => a.request_id === r.id);
  const stage = data.payments.find((p) => p.request_id === r.id);
  const selected = data.suppliers.find((s) => s.id === agreement?.supplier_id);
  const quoteCount = new Set(quotes.map((q) => q.supplier_id)).size;
  async function revise(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!r) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await action(
        "request.save",
        undefined,
        {
          id: r.id,
          title: r.title,
          category: r.category,
          spec: {
            ...r.spec,
            exactText: String(form.get("exactText")),
            dimensions: String(form.get("dimensions")),
            material: String(form.get("material")),
            deadline: String(form.get("deadline")),
          },
          confirm: true,
        },
        "New requirement version confirmed. Affected approvals are invalid.",
      );
      setRevision(false);
    } catch {
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-enter request-detail">
      <Link href="/requests" className="back-link">
        <ArrowLeft size={15} />
        All requests
      </Link>
      <div className="request-detail-heading">
        <div>
          <div className="eyebrow">
            {r.code}
            <span className="eyebrow-separator">/</span>
            {r.category}
            <span className="version-label">
              Requirements v{r.version || "draft"}
            </span>
          </div>
          <h1>{r.title}</h1>
          <div className="request-subtitle">
            <span>
              <Package size={14} />
              {r.spec.quantity.toLocaleString()} {r.spec.unit}
            </span>
            <span>
              <CalendarDays size={14} />
              Needed by {date(r.spec.deadline, { year: "numeric" })}
            </span>
            <span>
              <MapPin size={14} />
              {r.spec.destination || "Destination not specified"}
            </span>
          </div>
        </div>
        <div className="detail-heading-actions">
          <Status value={r.status} />
          {r.version > 0 && (
            <Button variant="secondary" onClick={() => setRevision(true)}>
              <Pencil size={14} />
              Revise requirements
            </Button>
          )}
          {r.version === 0 && (
            <Link
              href={`/requests/new?draft=${r.id}`}
              className="btn btn-primary"
            >
              Continue draft
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
      <div className="journey-progress">
        {[
          {
            label: r.version > 0 ? "Request confirmed" : "Define requirements",
            done: r.version > 0,
          },
          { label: "Supplier quotations", done: quoteCount > 0 },
          { label: "Agreement", done: !!agreement?.supplier_accepted },
          {
            label: "Evidence review",
            done: data.reviews.some(
              (v) =>
                v.request_id === r.id &&
                v.decision === "accepted" &&
                v.submission_id ===
                  data.submissions.find((s) => s.request_id === r.id)?.id,
            ),
          },
          { label: "Payment", done: !!stage?.capture_id },
        ].map((s, i, steps) => (
          <div
            key={s.label}
            className={
              s.done
                ? "progress-done"
                : steps.findIndex((step) => !step.done) === i
                  ? "progress-current"
                  : ""
            }
            aria-current={
              !s.done && steps.findIndex((step) => !step.done) === i
                ? "step"
                : undefined
            }
          >
            <strong className="journey-label">
              <span>{s.done ? <Check size={12} /> : i + 1}</span>
              {s.label}
            </strong>
            {i < 4 && <i />}
          </div>
        ))}
      </div>
      <nav className="request-tabs" aria-label="Request sections">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/requests/${r.id}?tab=${t.id}`}
            className={t.id === tab ? "tab-active" : ""}
            aria-current={t.id === tab ? "page" : undefined}
            scroll={false}
          >
            {t.label}
            {t.id === "quotes" && quoteCount > 0 && <span>{quoteCount}</span>}
            {t.id === "review" && r.status === "Needs your review" && (
              <i className="tab-dot" />
            )}
          </Link>
        ))}
      </nav>
      <div className="request-section-intro">
        <h2>{tabs.find((t) => t.id === tab)?.label}</h2>
        <p>
          {
            (
              {
                summary:
                  "Your confirmed requirements, current agreement and latest updates.",
                suppliers:
                  "Invite suppliers, review discovery results and follow each conversation.",
                quotes:
                  "Compare written offers and review the terms before choosing a supplier.",
                review:
                  "Check the supplier’s submitted files against your agreed requirements.",
                payments:
                  "Review the recipient, approval and verified payment activity.",
                history:
                  "Follow the decisions and activity recorded for this request.",
              } as Record<string, string>
            )[tab]
          }
        </p>
      </div>
      {tab === "summary" && (
        <div className="summary-layout">
          <div>
            <section className="panel">
              <div className="panel-head">
                <h2>The request</h2>
                <Badge tone="green">
                  {r.version ? `Approved v${r.version}` : "Draft"}
                </Badge>
              </div>
              <div className="panel-body">
                <p className="request-description">
                  {r.spec.description ||
                    "Add a description to complete this brief."}
                </p>
                <dl className="detail-grid requirements-grid">
                  <div>
                    <dt>Quantity</dt>
                    <dd>
                      {r.spec.quantity.toLocaleString()} {r.spec.unit}
                    </dd>
                  </div>
                  {r.category !== "Beverage wholesale" && (
                    <div>
                      <dt>Dimensions</dt>
                      <dd>{r.spec.dimensions || "Not specified"}</dd>
                    </div>
                  )}
                  <div>
                    <dt>
                      {r.category === "Beverage wholesale"
                        ? "Pack size"
                        : "Material"}
                    </dt>
                    <dd>{r.spec.material || "Not specified"}</dd>
                  </div>
                  {r.category !== "Beverage wholesale" && (
                    <>
                      <div>
                        <dt>Colour / finish</dt>
                        <dd>{r.spec.colour || "Not specified"}</dd>
                      </div>
                      <div>
                        <dt>Exact printed text</dt>
                        <dd className="exact-text">
                          {r.spec.exactText || "Not specified"}
                        </dd>
                      </div>
                      <div>
                        <dt>Required element</dt>
                        <dd>{r.spec.requiredElement || "Not specified"}</dd>
                      </div>
                    </>
                  )}
                  <div>
                    <dt>Delivery destination</dt>
                    <dd>{r.spec.destination || "Not specified"}</dd>
                  </div>
                  <div>
                    <dt>Total budget ceiling</dt>
                    <dd>{money(r.spec.budget, r.spec.currency)}</dd>
                  </div>
                </dl>
                {r.spec.visualNotes && (
                  <div className="note-box">
                    <span className="field-label">
                      {r.category === "Beverage wholesale"
                        ? "Delivery inspection & reference notes"
                        : "Visual requirements & reference notes"}
                    </span>
                    <p>{r.spec.visualNotes}</p>
                  </div>
                )}
                <div className="budget-inclusions">
                  <span>
                    <CheckCircle2 size={14} />
                    Tax {r.spec.taxIncluded
                      ? "included in"
                      : "additional to"}{" "}
                    budget
                  </span>
                  <span>
                    <CheckCircle2 size={14} />
                    Delivery{" "}
                    {r.spec.shippingIncluded
                      ? "included in"
                      : "additional to"}{" "}
                    budget
                  </span>
                </div>
              </div>
            </section>
            <section className="panel summary-files">
              <div className="panel-head">
                <h2>Approved reference files</h2>
                <Link
                  href={`/requests/${r.id}?tab=review`}
                  className="text-link"
                >
                  Files & review
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              {data.assets.filter(
                (a) =>
                  a.request_id === r.id &&
                  !["Supplier submission", "Quotation PDF"].includes(a.role),
              ).length ? (
                <div className="asset-list">
                  {data.assets
                    .filter(
                      (a) =>
                        a.request_id === r.id &&
                        !["Supplier submission", "Quotation PDF"].includes(
                          a.role,
                        ),
                    )
                    .map((a) => (
                      <a
                        className="asset-row"
                        href={`/api/assets/${a.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        key={a.id}
                      >
                        <FileIcon />
                        <div>
                          <strong>{a.name}</strong>
                          <span>
                            {a.role} · {(a.size / 1024).toFixed(0)} KB
                          </span>
                        </div>
                        <ArrowUpRight size={16} />
                      </a>
                    ))}
                </div>
              ) : (
                <p className="panel-body muted">
                  No files in this request. Text requirements are preserved in
                  version {r.version}.
                </p>
              )}
            </section>
            <section className="panel">
              <div className="panel-head">
                <h2>Latest updates</h2>
                <Link
                  href={`/requests/${r.id}?tab=history`}
                  className="text-link"
                >
                  Full history
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <ActivityList requestId={r.id} limit={3} />
            </section>
          </div>
          <aside>
            <section className="panel agreement-card">
              <div className="agreement-card-icon">
                <ShieldCheck size={24} />
              </div>
              <span className="section-kicker">CURRENT AGREEMENT</span>
              <h3>{selected?.company || "Your supplier, yet to be chosen."}</h3>
              {agreement ? (
                <>
                  <p>{agreement.stage}</p>
                  <div className="agreement-amount">
                    {money(agreement.amount, agreement.currency)}
                    <span>{agreement.currency} · confirmed total</span>
                  </div>
                  <div className="agreement-check">
                    <CheckCircle2 size={15} />
                    Buyer{" "}
                    {agreement.buyer_accepted
                      ? "accepted"
                      : "acceptance needed"}
                  </div>
                  <div className="agreement-check">
                    <CheckCircle2 size={15} />
                    Supplier{" "}
                    {agreement.supplier_accepted
                      ? "accepted"
                      : "acceptance needed"}
                  </div>
                  <Link
                    className="btn btn-primary"
                    href={`/requests/${r.id}?tab=review`}
                  >
                    Review supplier evidence
                    <ArrowRight size={15} />
                  </Link>
                </>
              ) : (
                <>
                  <p>
                    Collect written quotations before selecting a supplier and
                    agreeing a stage.
                  </p>
                  <Link
                    className="btn btn-primary"
                    href={`/requests/${r.id}?tab=suppliers`}
                  >
                    Invite suppliers
                    <ArrowRight size={15} />
                  </Link>
                </>
              )}
            </section>
            <div className="scope-card">
              <h3>
                <Users size={17} />
                Outreach boundaries
              </h3>
              <p>{r.spec.supplierIds.length} regular suppliers selected</p>
              <p>
                {r.spec.discover
                  ? `Up to ${r.spec.maxContacts} new contacts · ${r.spec.region || "Region needed"}`
                  : "No new supplier search"}
              </p>
              <p>
                {r.spec.outreachStart}–{r.spec.outreachEnd}
                <small>{r.spec.timezone}</small>
              </p>
              <Link
                href={`/requests/${r.id}?tab=suppliers`}
                className="text-link"
              >
                See suppliers & calls
                <ArrowRight size={14} />
              </Link>
            </div>
          </aside>
        </div>
      )}
      {tab === "suppliers" && <SuppliersTab request={r} />}
      {tab === "quotes" && <QuotesTab request={r} />}
      {tab === "review" && <EvidenceReview request={r} />}
      {tab === "payments" && <RequestPayments request={r} />}
      {tab === "history" && (
        <section className="panel">
          <div className="panel-head">
            <h2>Request history</h2>
            <span className="muted">Append-only decision trail</span>
          </div>
          <ActivityList requestId={r.id} />
        </section>
      )}
      {revision && (
        <Modal
          title={`Create requirement version ${r.version + 1}`}
          onClose={() => setRevision(false)}
        >
          <form onSubmit={revise}>
            <Notice>
              Changes invalidate the current agreement and evidence acceptance.
              Collect an updated written quote and fresh supplier confirmation.
              Requests with a PayPal order cannot be revised in place.
            </Notice>
            <Field label="Exact printed text">
              <textarea
                name="exactText"
                defaultValue={r.spec.exactText}
                rows={2}
              />
            </Field>
            <Field label="Dimensions">
              <input name="dimensions" defaultValue={r.spec.dimensions} />
            </Field>
            <Field label="Material">
              <input name="material" defaultValue={r.spec.material} />
            </Field>
            <Field label="Deadline">
              <input
                name="deadline"
                type="date"
                defaultValue={r.spec.deadline}
              />
            </Field>
            <div className="modal-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setRevision(false)}
              >
                Cancel
              </Button>
              <Button type="submit" busy={busy}>
                Confirm new version
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
type ConversationFacts = {
  commercial: { label: string; value: string; evidence: string }[];
  requirementVersion?: number;
  sentContext?: {
    appId: string;
    appVersion: number;
    agentVariables: { supplier_name: string; procurement_brief: string };
  };
  providerContext?: {
    appVersion?: number | null;
    agentVariables: { supplier_name?: string; procurement_brief?: string };
    checkedAt: string;
  };
  contextError?: string;
  quoteDraftError?: string;
  quoteDraft?: Record<
    string,
    { value: string | null; evidence: string | null }
  >;
};
function conversationFacts(raw: string | null | undefined): ConversationFacts {
  if (!raw) return { commercial: [] };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed))
      return {
        commercial: parsed
          .filter((fact) => fact && typeof fact === "object")
          .map((fact) => ({
            label: String(fact.label ?? ""),
            value: String(fact.value ?? ""),
            evidence: String(fact.evidence ?? ""),
          })),
      };
    if (parsed && typeof parsed === "object")
      return { ...parsed, commercial: [] };
  } catch {
    return {
      commercial: [],
      contextError: "The saved call context could not be read.",
    };
  }
  return { commercial: [] };
}
function CallContextDetails({ facts }: { facts: ConversationFacts }) {
  return (
    <div className="note-box">
      <h3>Call context</h3>
      {facts.contextError && <Notice>{facts.contextError}</Notice>}
      {facts.quoteDraftError && <Notice>{facts.quoteDraftError}</Notice>}
      {facts.quoteDraft && (
        <Notice tone="green">
          Call terms are ready as a supplier-review draft. The private quotation
          link prefills these terms; the supplier must correct missing or
          inaccurate fields and submit.
        </Notice>
      )}
      {facts.sentContext ? (
        <details>
          <summary>Request details sent to Sarvam</summary>
          <p className="field-hint">
            Agent {facts.sentContext.appId} · Version{" "}
            {facts.sentContext.appVersion}
            {facts.requirementVersion != null &&
              ` · Requirements v${facts.requirementVersion}`}
          </p>
          <p>
            Supplier:{" "}
            {facts.sentContext.agentVariables.supplier_name || "Not supplied"}
          </p>
          <pre className="transcript">
            {facts.sentContext.agentVariables.procurement_brief ||
              "No brief supplied."}
          </pre>
        </details>
      ) : (
        <p className="muted">
          No sent-context snapshot was saved for this older call. Its exact
          outbound brief cannot be reconstructed from this record.
        </p>
      )}
      {facts.providerContext ? (
        <details>
          <summary>Final variable values reported by Sarvam</summary>
          <p className="field-hint">
            Retrieved {date(facts.providerContext.checkedAt)}
            {facts.providerContext.appVersion != null &&
              ` · Agent version ${facts.providerContext.appVersion}`}
          </p>
          <p>
            These are the provider’s final stored values. They do not prove
            which values the model used during the conversation; compare the
            transcript and Sarvam’s starting context.
          </p>
          <p>
            Supplier:{" "}
            {facts.providerContext.agentVariables.supplier_name ||
              "Not reported"}
          </p>
          <pre className="transcript">
            {facts.providerContext.agentVariables.procurement_brief ||
              "No purchasing brief reported."}
          </pre>
        </details>
      ) : (
        <p className="muted">
          Provider variable values have not been retrieved. Refresh provider
          status to check for available context.
        </p>
      )}
    </div>
  );
}
function SuppliersTab({ request: r }: { request: PurchaseRequest }) {
  const { data, action, toast } = useWorkspace();
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailAccepted, setEmailAccepted] = useState(false);
  const [link, setLink] = useState<{
      company: string;
      url: string;
      publicUrl: string | null;
      email: string;
    } | null>(null),
    [outreach, setOutreach] = useState(false),
    [callId, setCallId] = useState(""),
    [callSupplier, setCallSupplier] = useState<Supplier | null>(null),
    [callConsent, setCallConsent] = useState(false),
    [busy, setBusy] = useState("");
  const suppliers = data.suppliers.filter(
    (s) =>
      r.spec.supplierIds.includes(s.id) ||
      data.quotes.some((q) => q.request_id === r.id && q.supplier_id === s.id),
  );
  const calls = data.calls.filter((c) => c.request_id === r.id);
  const call = calls.find((c) => c.id === callId);
  const callFacts = conversationFacts(call?.facts);
  const candidates = data.candidates.filter((c) => c.request_id === r.id);
  const searchJob = data.jobs.find(
    (j) =>
      j.request_id === r.id &&
      j.kind === "discovery" &&
      ["queued", "running"].includes(j.status),
  );
  async function createInvite(s: Supplier) {
    setBusy(s.id);
    try {
      const result = await action("invitation.create", r.id, {
        supplierId: s.id,
      });
      setEmailAccepted(false);
      setLink({
        company: s.company,
        url: result.url,
        publicUrl: result.publicUrl || null,
        email: s.email,
      });
    } catch {
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="suppliers-tab">
      <div className="tab-section-heading">
        <div>
          <h2>The right people for this request</h2>
          <p>
            Your regulars and written offers, with an explicit scope for new
            enquiries.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setOutreach(true)}>
          <Phone size={15} />
          Review outreach scope
        </Button>
      </div>
      <section className="panel">
        <div className="panel-head">
          <div className="section-title">
            <h2>Participating suppliers</h2>
            <span className="count-badge">{suppliers.length}</span>
          </div>
          <Link href="/suppliers" className="text-link">
            Supplier directory
            <ArrowUpRight size={14} />
          </Link>
        </div>
        {suppliers.length ? (
          suppliers.map((s) => (
            <div className="participating-supplier" key={s.id}>
              <span className="small-monogram">{s.company[0]}</span>
              <div>
                <strong>{s.company}</strong>
                <small>
                  {s.location || "Location not specified"} · {s.relationship}
                </small>
              </div>
              <span className="participating-state">
                {data.quotes.some(
                  (q) => q.request_id === r.id && q.supplier_id === s.id,
                ) ? (
                  <Badge tone="green">Written quote received</Badge>
                ) : (
                  <Badge>Waiting for supplier</Badge>
                )}
              </span>
              <Button
                variant="secondary"
                busy={busy === s.id}
                disabled={s.do_not_contact === 1 || !r.version}
                onClick={() => void createInvite(s)}
              >
                <Mail size={14} />
                Create quote link
              </Button>
              <Button
                variant="secondary"
                disabled={!r.version || !!s.do_not_contact}
                onClick={() => {
                  setCallSupplier(s);
                  setCallConsent(false);
                }}
              >
                <Phone size={14} />
                Call supplier
              </Button>
            </div>
          ))
        ) : (
          <Empty
            title="Your suppliers go here"
            description="Add regular suppliers to the directory, then create a scoped quote invitation."
          />
        )}
      </section>
      <div className="supplier-secondary-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Find additional suppliers</h2>
            <Globe size={18} />
          </div>
          <div className="panel-body">
            <div className="discovery-scope">
              <div>
                <span>Delivery region</span>
                <strong>{r.spec.region || "Not specified"}</strong>
              </div>
              <div>
                <span>Maximum new contacts</span>
                <strong>{r.spec.maxContacts}</strong>
              </div>
            </div>
            <p className="muted">
              Search public sources. Review contact details and delivery
              coverage before inviting a candidate. Private artwork is never
              shared by search.
            </p>
            <Button
              variant="secondary"
              busy={!!searchJob}
              onClick={() =>
                void action(
                  "discovery.start",
                  r.id,
                  undefined,
                  "Supplier search queued.",
                ).catch(() => {})
              }
            >
              <Search size={15} />
              {searchJob ? "Searching…" : "Find supplier candidates"}
            </Button>
            {data.integrations.find((i) => i.id === "search")?.status ===
              "Setup required" && (
              <Link href="/settings" className="setup-inline">
                Connect supplier search
                <ArrowUpRight size={13} />
              </Link>
            )}
            {candidates.map((c) => (
              <div className="candidate" key={c.id}>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link"
                >
                  {c.title}
                  <ArrowUpRight size={14} />
                </a>
                <p>{c.evidence}</p>
                <small>
                  Retrieved {date(c.retrieved_at)} · Contact and coverage not
                  yet checked
                </small>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Conversations & calls</h2>
            <Phone size={17} />
          </div>
          {calls.length ? (
            calls.map((c) => (
              <button
                className="call-record"
                onClick={() => setCallId(c.id)}
                key={c.id}
              >
                <span className="call-icon">
                  <Phone size={17} />
                </span>
                <div>
                  <strong>
                    {
                      data.suppliers.find((s) => s.id === c.supplier_id)
                        ?.company
                    }
                  </strong>
                  <small>
                    {data.workspace.mode === "sample"
                      ? "Labelled sample transcript"
                      : c.provider_id || "Not connected"}
                  </small>
                </div>
                <Status value={c.status} />
                <ChevronRight size={16} />
              </button>
            ))
          ) : (
            <Empty
              icon={Phone}
              title="No conversations yet"
              description="Connect Sarvam and verify an allowlisted test number before launching a call."
            />
          )}
          <div className="panel-body">
            <p className="field-hint">
              A conversation is an enquiry. Only a written quotation can become
              an agreement.
            </p>
            <Link href="/settings" className="text-link">
              Voice provider setup
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
      </div>
      {link && (
        <Modal
          title={`Quote invitation for ${link.company}`}
          onClose={() => setLink(null)}
        >
          <Notice tone="green">
            Your private link is ready. It expires in 7 days and shares only
            this request’s approved files.{" "}
            {emailAccepted
              ? "Email provider accepted the invitation; inbox delivery is not yet verified."
              : "No message has been sent."}
          </Notice>
          {!link.publicUrl && (
            <Notice>
              Public sharing requires deployment. Set APP_URL to your public
              HTTPS address and restart the app. This localhost link works only
              on your computer.
            </Notice>
          )}
          <div className="private-link-box">
            <span>
              {link.publicUrl ||
                (typeof window !== "undefined" ? window.location.origin : "") +
                  link.url}
            </span>
          </div>
          <p className="muted">
            Email recipient:{" "}
            {link.email ||
              "Add the supplier’s email in the supplier directory."}
          </p>
          <div className="modal-actions">
            <Button
              disabled={
                !link.publicUrl || !link.email || emailBusy || emailAccepted
              }
              onClick={async () => {
                setEmailBusy(true);
                try {
                  await action(
                    "invitation.email",
                    r.id,
                    { token: link.url.split("/").pop() },
                    "Email provider accepted the invitation.",
                  );
                  setEmailAccepted(true);
                } catch {
                } finally {
                  setEmailBusy(false);
                }
              }}
            >
              <Mail size={15} />
              {emailBusy
                ? "Sending…"
                : emailAccepted
                  ? "Email accepted"
                  : "Email invitation"}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                void navigator.clipboard
                  .writeText(link.publicUrl || location.origin + link.url)
                  .then(() => toast("Private link copied."))
                  .catch(() =>
                    toast("Open the portal and copy the address.", true),
                  )
              }
            >
              <Copy size={15} />
              Copy link
            </Button>
            <a
              className="btn btn-primary"
              href={link.publicUrl || link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open supplier portal
              <ArrowUpRight size={15} />
            </a>
          </div>
        </Modal>
      )}
      {callSupplier && (
        <Modal
          title={`Call ${callSupplier.company}`}
          onClose={() => setCallSupplier(null)}
        >
          <p>
            {callSupplier.phone ||
              "Add a phone number with country code before calling."}
          </p>
          <p>
            Language: {r.spec.language}. Hours: {r.spec.outreachStart}–
            {r.spec.outreachEnd} {r.spec.timezone}.
          </p>
          <details>
            <summary>Change calling hours</summary>
            <p className="muted">
              Set the hours agreed with your supplier. This changes this
              request’s calling window; it does not place a call.
            </p>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                setBusy("schedule");
                try {
                  await action(
                    "outreach.schedule",
                    r.id,
                    { start: form.get("start"), end: form.get("end") },
                    "Calling hours updated.",
                  );
                } catch {
                } finally {
                  setBusy("");
                }
              }}
            >
              <Field label="Calls from">
                <input
                  type="time"
                  name="start"
                  defaultValue={r.spec.outreachStart}
                  required
                />
              </Field>
              <Field label="Calls until">
                <input
                  type="time"
                  name="end"
                  defaultValue={r.spec.outreachEnd}
                  required
                />
              </Field>
              <Button type="submit" variant="secondary" disabled={!!busy}>
                Save calling hours
              </Button>
            </form>
          </details>
          <Notice>
            Requires a configured Sarvam agent, supported destination and an
            allowlisted consenting number. A call is an enquiry; quotes and
            payments require separate confirmation.
          </Notice>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={callConsent}
              onChange={(e) => setCallConsent(e.target.checked)}
            />
            <span>This contact has agreed to receive this AI call.</span>
          </label>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setCallSupplier(null)}>
              Cancel
            </Button>
            <Button
              busy={busy === "call"}
              disabled={!callConsent || !callSupplier.phone}
              onClick={() => {
                setBusy("call");
                void action(
                  "outreach.call",
                  r.id,
                  { supplierId: callSupplier.id, consent: true },
                  "Call attempt submitted. Refresh provider status to check the outcome.",
                )
                  .then(() => setCallSupplier(null))
                  .catch(() => {})
                  .finally(() => setBusy(""));
              }}
            >
              Place call
            </Button>
          </div>
        </Modal>
      )}
      {outreach && (
        <Modal
          title="Your approved outreach scope"
          onClose={() => setOutreach(false)}
        >
          <dl className="detail-grid">
            <div>
              <dt>Suppliers</dt>
              <dd>
                {suppliers.map((s) => s.company).join(", ") || "None selected"}
              </dd>
            </div>
            <div>
              <dt>New supplier limit</dt>
              <dd>
                {r.spec.maxContacts} · {r.spec.region || "Region not specified"}
              </dd>
            </div>
            <div>
              <dt>Hours</dt>
              <dd>
                {r.spec.outreachStart}–{r.spec.outreachEnd} · {r.spec.timezone}
              </dd>
            </div>
            <div>
              <dt>Language / channel</dt>
              <dd>
                {r.spec.language} · {r.spec.channel}
              </dd>
            </div>
          </dl>
          <div className="note-box">
            <strong>Negotiable</strong>
            <p>{r.spec.negotiable}</p>
            <strong>Ask the owner</strong>
            <p>{r.spec.askOwner}</p>
          </div>
          <Notice>
            Outbound calling is limited to consenting test numbers and requires
            verified account capabilities. No calls will be placed until
            provider setup is complete.
          </Notice>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setOutreach(false)}>
              Close
            </Button>
            <Button
              onClick={() =>
                void action("outreach.launch", r.id).catch(() => {})
              }
            >
              <Phone size={15} />
              Check launch readiness
            </Button>
          </div>
        </Modal>
      )}
      {call && (
        <Modal title="Supplier conversation" onClose={() => setCallId("")} wide>
          {data.workspace.mode === "sample" && (
            <Notice tone="neutral">
              Fictional sample transcript. This was not a real provider call.
            </Notice>
          )}
          {call.error && <Notice>{call.error}</Notice>}
          <div className="transcript-layout">
            <div>
              <h3>Provider transcript</h3>
              {data.workspace.mode !== "sample" && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    void action(
                      "outreach.sync",
                      r.id,
                      { callId: call.id },
                      "Provider status refreshed.",
                    ).catch(() => {})
                  }
                >
                  Refresh provider status
                </Button>
              )}
              <pre className="transcript">
                {call.transcript ||
                  "No authenticated transcript has been received."}
              </pre>
            </div>
            <div>
              <h3>Commercial facts</h3>
              {callFacts.commercial.length ? (
                callFacts.commercial.map((f, i) => (
                  <div className="fact-evidence" key={i}>
                    <span>{f.label}</span>
                    <strong>{f.value}</strong>
                    <blockquote>“{f.evidence}”</blockquote>
                  </div>
                ))
              ) : (
                <p className="muted">No extracted facts.</p>
              )}
            </div>
          </div>
          {data.workspace.mode !== "sample" && (
            <CallContextDetails facts={callFacts} />
          )}
        </Modal>
      )}
    </div>
  );
}
function QuotesTab({ request: r }: { request: PurchaseRequest }) {
  const { data, action } = useWorkspace();
  const [filter, setFilter] = useState("All suppliers"),
    [evidence, setEvidence] = useState<Quote | null>(null),
    [select, setSelect] = useState<Quote | null>(null),
    [follow, setFollow] = useState<Quote | null>(null),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState("");
  const latest = data.quotes.filter(
    (q) =>
      q.request_id === r.id &&
      !data.quotes.some(
        (other) =>
          other.request_id === r.id &&
          other.supplier_id === q.supplier_id &&
          other.version > q.version,
      ),
  );
  const filtered = latest.filter((q) =>
    filter === "Regular suppliers"
      ? q.relationship === "Regular"
      : filter === "Meets requirements"
        ? quoteProblems(q, r).length === 0
        : true,
  );
  const eligible = latest
    .filter((q) => quoteProblems(q, r).length === 0)
    .sort((a, b) => a.total! - b.total!);
  const recommended = eligible[0];
  const agreement = data.agreements.find((a) => a.request_id === r.id);
  const onEvidence = useCallback((q: Quote) => setEvidence(q), []);
  async function confirmSelect() {
    if (!select) return;
    setBusy(true);
    try {
      await action(
        "quote.select",
        r.id,
        { quoteId: select.id },
        "Supplier selected. Share an invitation for supplier agreement.",
      );
      setSelect(null);
    } catch {
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="tab-section-heading">
        <div>
          <h2>A clearer comparison. A considered choice.</h2>
          <p>
            Written quotations, known costs and the tradeoffs behind each offer.
          </p>
        </div>
        <span className="grid-provider-label">
          <span />
          AG Grid Community
        </span>
      </div>
      {recommended && (
        <div className="recommendation">
          <span className="recommendation-icon">
            <ShieldCheck size={25} />
          </span>
          <div>
            <span className="section-kicker">
              BASED ON YOUR CONFIRMED REQUIREMENTS
            </span>
            <h3>
              {recommended.company} has the lowest confirmed total that meets
              your deadline.
            </h3>
            <p>
              {money(recommended.total, recommended.currency)} for{" "}
              {recommended.quantity} {r.spec.unit}, including{" "}
              {money(recommended.shipping, recommended.currency)} shipping and{" "}
              {money(recommended.tax, recommended.currency)} tax. Written quote
              v{recommended.version}.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setEvidence(recommended)}>
            See the evidence
            <ArrowRight size={15} />
          </Button>
        </div>
      )}
      <section className="panel comparison-panel">
        <div className="panel-head">
          <div className="section-title">
            <h2>Compare quotations</h2>
            <span className="count-badge">{latest.length}</span>
          </div>
          <select
            aria-label="Filter quotation comparison"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option>All suppliers</option>
            <option>Regular suppliers</option>
            <option>Meets requirements</option>
          </select>
        </div>
        {filtered.length ? (
          <QuoteGrid quotes={filtered} request={r} onEvidence={onEvidence} />
        ) : (
          <Empty
            icon={FileText}
            title="No written offers here yet"
            description="Invite suppliers to submit a written quote, with tax and shipping explicitly specified."
          />
        )}
        <div className="panel-foot">
          <span>
            Totals calculated on the server. Unknown costs remain unknown.
          </span>
          <span>AG Studio analytics: setup required</span>
        </div>
      </section>
      <div className="quote-cards">
        {filtered.map((q) => {
          const problems = quoteProblems(q, r);
          return (
            <section
              className={`panel quote-decision-card ${agreement?.quote_id === q.id ? "quote-selected" : ""}`}
              key={q.id}
            >
              <div className="quote-decision-head">
                <span className="small-monogram">{q.company?.[0] || "S"}</span>
                <div>
                  <h3>{q.company}</h3>
                  <small>
                    {q.relationship} · Written v{q.version}
                  </small>
                </div>
                {agreement?.quote_id === q.id && (
                  <Badge tone="green">Selected</Badge>
                )}
              </div>
              <div className="quote-total">
                {money(q.total, q.currency)}
                <small>
                  {q.total === null
                    ? "Total incomplete"
                    : "Total including tax & delivery"}
                </small>
              </div>
              <div className="quote-reasons">
                {problems.length ? (
                  problems.map((p) => (
                    <span className="text-amber" key={p}>
                      <CircleHelp size={14} />
                      {p}
                    </span>
                  ))
                ) : (
                  <span className="text-green">
                    <CheckCircle2 size={14} />
                    Meets confirmed requirements
                  </span>
                )}
              </div>
              <div className="quote-card-actions">
                <Button
                  variant={
                    agreement?.quote_id === q.id ? "secondary" : "primary"
                  }
                  disabled={problems.length > 0 || agreement?.quote_id === q.id}
                  onClick={() => setSelect(q)}
                >
                  {agreement?.quote_id === q.id
                    ? "Current agreement"
                    : "Select supplier"}
                  {agreement?.quote_id !== q.id && <ArrowRight size={14} />}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFollow(q);
                    setNote("");
                  }}
                >
                  <MessageSquare size={14} />
                  Follow up
                </Button>
              </div>
            </section>
          );
        })}
      </div>
      {evidence && (
        <Modal
          title={`Quotation evidence · ${evidence.company}`}
          onClose={() => setEvidence(null)}
          wide
        >
          <div className="detail-badges">
            <Badge tone="green">Written confirmation</Badge>
            <Badge>Quote v{evidence.version}</Badge>
            <Badge>Requirement v{evidence.requirement_version}</Badge>
          </div>
          <dl className="detail-grid">
            <div>
              <dt>Unit price × quantity</dt>
              <dd>
                {money(evidence.unit_price, evidence.currency)} ×{" "}
                {evidence.quantity}
              </dd>
            </div>
            <div>
              <dt>Subtotal</dt>
              <dd>{money(evidence.subtotal, evidence.currency)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>{money(evidence.shipping, evidence.currency)}</dd>
            </div>
            <div>
              <dt>Tax</dt>
              <dd>{money(evidence.tax, evidence.currency)}</dd>
            </div>
            <div>
              <dt>Confirmed total</dt>
              <dd>{money(evidence.total, evidence.currency)}</dd>
            </div>
            <div>
              <dt>Delivery / expiry</dt>
              <dd>
                {date(evidence.completion_date)} / {date(evidence.valid_until)}
              </dd>
            </div>
          </dl>
          <div className="note-box">
            <strong>Payment conditions</strong>
            <p>{evidence.payment_terms}</p>
            <strong>Exclusions and tradeoffs</strong>
            <p>
              {evidence.exclusions || "No exclusions declared by supplier."}
            </p>
          </div>
          <Notice tone={quoteProblems(evidence, r).length ? "amber" : "green"}>
            {quoteProblems(evidence, r).length
              ? quoteProblems(evidence, r).join(" · ")
              : "This written offer meets the current quantity, deadline, budget and declared requirements."}
          </Notice>
          <p className="field-hint">
            Source:{" "}
            {data.workspace.mode === "sample"
              ? "Labelled fictional sample quotation"
              : "Supplier invitation submission"}{" "}
            ·{" "}
            {date(evidence.created_at, {
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            . No previous orders unless a real capture is recorded.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setEvidence(null)}>
              Close evidence
            </Button>
            <Button
              disabled={
                !!quoteProblems(evidence, r).length ||
                agreement?.quote_id === evidence.id
              }
              onClick={() => {
                setSelect(evidence);
                setEvidence(null);
              }}
            >
              Select this supplier
            </Button>
          </div>
        </Modal>
      )}
      {select && (
        <Modal
          title="Confirm your supplier selection"
          onClose={() => setSelect(null)}
        >
          <div className="financial-summary">
            <span>Supplier</span>
            <h3>{select.company}</h3>
            <strong>{money(select.total, select.currency)}</strong>
            <span>
              {r.category === "Beverage wholesale"
                ? "Stock delivery & invoice review"
                : "Artwork approval & production"}{" "}
              · Requirement v{r.version}
            </span>
          </div>
          <p>
            A versioned agreement will preserve this quotation, approved
            requirements and files. The supplier must accept it before payment.
          </p>
          <Notice tone="neutral">
            Selecting a quote does not authorize or capture funds. There are no
            automatic payments.
          </Notice>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setSelect(null)}>
              Go back
            </Button>
            <Button busy={busy} onClick={() => void confirmSelect()}>
              Confirm supplier
              <Check size={15} />
            </Button>
          </div>
        </Modal>
      )}
      {follow && (
        <Modal
          title={`Follow up with ${follow.company}`}
          onClose={() => setFollow(null)}
        >
          <p className="muted">
            Record your question for the supplier. No message will be sent
            automatically.
          </p>
          <Field label="Question or revised quote request">
            <textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Please confirm tax and revise the delivery date."
            />
          </Field>
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setFilter("Regular suppliers");
                setFollow(null);
              }}
            >
              Compare regular suppliers
            </Button>
            <Button
              disabled={note.trim().length < 3}
              onClick={() =>
                void action(
                  "request.note",
                  r.id,
                  { note: `Follow-up for ${follow.company}: ${note}` },
                  "Follow-up recorded in request history.",
                )
                  .then(() => setFollow(null))
                  .catch(() => {})
              }
            >
              Save follow-up
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
