"use client";
import { date, money, relative } from "@/lib/format";
import type { PurchaseRequest } from "@/lib/types";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleAlert,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  Layers,
  ListFilter,
  MessagesSquare,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useWorkspace } from "./context";
import { Badge, Button, Empty, Status } from "./ui";
import { PayPalMark, PayPalBrand } from "./paypal-brand";
const categoryIcon = (category: string) =>
  /label/i.test(category)
    ? Tag
    : /merchandise/i.test(category)
      ? ShoppingBag
      : /stationery/i.test(category)
        ? FileText
        : Package;
export function RequestList({
  requests,
  compact = false,
}: {
  requests: PurchaseRequest[];
  compact?: boolean;
}) {
  const { data } = useWorkspace();
  return requests.length ? (
    <div className="request-table-wrap">
      <table
        className={`request-table ${compact ? "request-table-compact" : ""}`}
      >
        <thead>
          <tr>
            <th>Request</th>
            <th>Status</th>
            <th>Needed by</th>
            <th>Offers</th>
            <th>
              <span className="sr-only">Open request</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => {
            const Icon = categoryIcon(r.category);
            const quotes = new Set(
              data.quotes
                .filter((q) => q.request_id === r.id && !q.declined)
                .map((q) => q.supplier_id),
            ).size;
            return (
              <tr key={r.id}>
                <td>
                  <Link href={`/requests/${r.id}`} className="request-cell">
                    <span
                      className={`category-icon ${/label/.test(r.category) ? "category-tan" : /merchandise/.test(r.category) ? "category-blue" : ""}`}
                    >
                      <Icon size={21} strokeWidth={1.6} />
                    </span>
                    <span>
                      <strong>{r.title}</strong>
                      <small>
                        {r.code}
                        <span>·</span>
                        {r.spec.quantity.toLocaleString()} {r.spec.unit}
                      </small>
                    </span>
                  </Link>
                </td>
                <td>
                  <Status value={r.status} />
                  <small className="next-action">
                    {r.status === "Needs your review"
                      ? "Review supplier artwork"
                      : r.status === "Comparing quotes"
                        ? "Compare written offers"
                        : r.status === "Draft"
                          ? "Finish requirements"
                          : r.status === "Ready for payment"
                            ? "Review payment stage"
                            : "Awaiting next update"}
                  </small>
                </td>
                <td>
                  <span className="table-date">{date(r.spec.deadline)}</span>
                  <small className="table-year">
                    {new Date(r.spec.deadline).getFullYear()}
                  </small>
                </td>
                <td>
                  <span className="offer-count">
                    <MessagesSquare size={14} />
                    {quotes
                      ? `${quotes} ${quotes === 1 ? "offer" : "offers"}`
                      : "—"}
                  </span>
                </td>
                <td>
                  <Link
                    className="row-arrow"
                    href={`/requests/${r.id}`}
                    aria-label={`Open ${r.title}`}
                  >
                    <ArrowUpRight size={17} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      title="Make room for your next good idea"
      description="Create a request to bring your requirements, suppliers and payments together."
    >
      <Link href="/requests/new" className="btn btn-primary">
        <Plus size={16} />
        New request
      </Link>
    </Empty>
  );
}
export function Overview() {
  const { data } = useWorkspace();
  const [filter, setFilter] = useState("All requests");
  const active = data.requests.filter(
    (r) => !["Paid", "Cancelled"].includes(r.status),
  );
  const attention = data.requests.filter((r) =>
    /review|correction|agreement/.test(r.status),
  );
  const offerCount = data.quotes.filter(
    (q) =>
      !data.agreements.some((a) => a.request_id === q.request_id) &&
      !data.quotes.some(
        (other) =>
          other.request_id === q.request_id &&
          other.supplier_id === q.supplier_id &&
          other.version > q.version,
      ) &&
      q.confirmed &&
      !q.declined,
  ).length;
  const paymentCount = data.payments.filter(
    (p) => !["Captured", "Refunded", "Voided"].includes(p.status),
  ).length;
  const featured = data.requests.find((r) => r.code === "PP-1042") || active[0];
  const draft = data.requests.find((r) => !r.version);
  const steps = [
    {
      title: draft ? "Complete your request" : "Create your first request",
      href: draft ? `/requests/new?draft=${draft.id}` : "/requests/new",
      icon: Package,
      done: data.requests.some((r) => r.version > 0),
    },
    {
      title: "Add your regular suppliers",
      href: "/suppliers",
      icon: MessagesSquare,
      done: data.suppliers.length > 0,
    },
    {
      title: "Connect PayPal sandbox",
      href: "/settings",
      icon: CreditCard,
      done: data.integrations.some(
        (i) => i.id === "paypal" && i.status === "Connected",
      ),
    },
  ];
  const metrics = [
    {
      title: "Active requests",
      value: active.length,
      icon: ClipboardList,
      note: `${data.requests.filter((r) => r.status === "Draft").length} in draft`,
      tone: "green",
    },
    {
      title: "Offers awaiting review",
      value: offerCount,
      icon: MessagesSquare,
      note: "Written supplier quotations",
      tone: "blue",
    },
    {
      title: "Payments awaiting action",
      value: paymentCount,
      icon: CreditCard,
      note: "Approval or setup needed",
      tone: "tan",
    },
    {
      title: "Orders needing attention",
      value: attention.length,
      icon: CircleAlert,
      note: "Your next decisions",
      tone: "amber",
    },
  ];
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            {data.workspace.name}
            <span className="eyebrow-separator">/</span>
            {date(new Date().toISOString(), {
              weekday: "short",
              year: "numeric",
            })}
          </div>
          <h1 aria-label="Purchasing overview.">
            Purchasing overview<span className="heading-dot">.</span>
          </h1>
          <p>From supplier conversation to verified payment.</p>
        </div>
        <Link href="/requests/new" className="btn btn-primary">
          <Plus size={17} />
          New request
        </Link>
      </div>
      <div className="overview-banner">
        <div className="banner-copy">
          <h2>
            Better deals. Verified work.
            <br />
            Confident payments.
          </h2>
          <p>Your purchasing, connected from first request to final payment.</p>
        </div>
        <div className="banner-flow">
          <span className="flow-document">
            <Package size={25} />
            <strong>Purchase brief</strong>
            <b />
            <b />
          </span>
          <i />
          <span className="flow-document">
            <CheckCircle2 size={25} />
            <strong>Proof review</strong>
            <b />
            <b />
          </span>
          <i />
          <span className="flow-paypal">
            <PayPalMark />
          </span>
        </div>
      </div>
      <div className="metrics">
        {metrics.map((m) => (
          <div className="metric" key={m.title}>
            <div className="metric-top">
              <span>{m.title}</span>
              <span className={`metric-icon metric-${m.tone}`}>
                <m.icon size={17} />
              </span>
            </div>
            <strong>{m.value}</strong>
            <div className="metric-note">
              <span className={`metric-note-dot metric-${m.tone}`} />
              {m.note}
            </div>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <section className="panel requests-panel">
          <div className="panel-head">
            <div className="section-title">
              <h2>Active requests</h2>
              <span className="count-badge">{active.length}</span>
            </div>
            <Link href="/requests" className="text-link subtle-link">
              View all
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="request-toolbar">
            <div className="segmented" aria-label="Filter requests">
              {["All requests", "Needs review", "Drafts"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={filter === f ? "selected" : ""}
                >
                  {f}
                  {f === "Needs review" && attention.length > 0 && (
                    <span>{attention.length}</span>
                  )}
                </button>
              ))}
            </div>
            <span className="toolbar-caption">
              <ListFilter size={15} />
              By latest activity
            </span>
          </div>
          <RequestList
            compact
            requests={active.filter((r) =>
              filter === "Needs review"
                ? /review|correction|agreement/.test(r.status)
                : filter === "Drafts"
                  ? r.status === "Draft"
                  : true,
            )}
          />
          <div className="panel-foot">
            <span>
              <Circle size={10} />
              Your next decision is always one click away.
            </span>
            <span>{active.length} requests</span>
          </div>
        </section>
        <aside className="attention-panel">
          {(attention.length > 0 ||
            data.payments.some((p) => p.status === "Not started")) && (
            <div className="attention-heading">
              <span className="attention-title">
                <span className="attention-dot" />
                Needs your attention
              </span>
              <span className="count-badge">
                {attention.length +
                  (data.payments.some((p) => p.status === "Not started")
                    ? 1
                    : 0)}
              </span>
            </div>
          )}
          {featured && /review|correction|agreement/.test(featured.status) && (
            <Link
              href={`/requests/${featured.id}?tab=review`}
              className="attention-card"
            >
              <div className="attention-card-top">
                <span className="attention-icon amber-icon">
                  <FileText size={18} />
                </span>
                <span>ARTWORK REVIEW</span>
                <ArrowUpRight size={15} />
              </div>
              <h3>{featured.title}</h3>
              <p>
                {featured.status === "Needs your review"
                  ? "A supplier proof is ready. Check the details before approving the next stage."
                  : "Keep your requirements and supplier evidence in sync."}
              </p>
              <div className="attention-card-bottom">
                <Status value={featured.status} />
                <ChevronRight size={14} />
              </div>
            </Link>
          )}
          {data.payments.some((p) => p.status === "Not started") && (
            <Link href="/settings" className="attention-card">
              <div className="attention-card-top">
                <span className="attention-icon blue-icon">
                  <CreditCard size={18} />
                </span>
                <span>PAYMENT SETUP</span>
                <ArrowUpRight size={15} />
              </div>
              <h3>Connect your PayPal sandbox</h3>
              <p>
                Set up your test merchant to authorize funds and complete a real
                sandbox payment.
              </p>
              <div className="attention-card-bottom">
                <span className="inline-status">
                  <span />
                  Setup required
                </span>
                <ChevronRight size={14} />
              </div>
            </Link>
          )}
          {!attention.length && (
            <section className="panel next-steps">
              <div className="panel-head">
                <h2>Next steps</h2>
                <span className="next-progress">
                  <i
                    style={{
                      width: `${(steps.filter((s) => s.done).length / 3) * 100}%`,
                    }}
                  />
                </span>
                <small>{steps.filter((s) => s.done).length} of 3</small>
              </div>
              <div className="panel-body">
                {steps.map((s, i) => (
                  <Link key={s.title} href={s.href}>
                    <span className="next-step-icon">
                      {i === 2 ? (
                        <PayPalMark />
                      ) : s.done ? (
                        <CheckCircle2 size={21} />
                      ) : (
                        <s.icon size={21} />
                      )}
                    </span>
                    <strong>{s.title}</strong>
                    <ChevronRight size={17} />
                  </Link>
                ))}
              </div>
            </section>
          )}
          <div className="attention-tip">
            <ShieldCheck size={17} />
            <p>
              Payments stay in your control.
              <br />
              <strong>Evidence first. Approval always.</strong>
            </p>
          </div>
        </aside>
      </div>
      <div className="overview-bottom">
        <section className="panel activity-panel">
          <div className="panel-head">
            <div className="section-title">
              <h2>Recent activity</h2>
              <span className="live-subtitle">Your purchasing paper trail</span>
            </div>
            <Link href="/activity" className="text-link subtle-link">
              All activity
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <ActivityList limit={3} />
        </section>
        <div className="journey-note">
          <div className="journey-note-icon">
            <Layers size={26} strokeWidth={1.4} />
          </div>
          <span className="small-caps">THE PROCUREPROOF WAY</span>
          <h3>
            One order.
            <br />
            One connected story.
          </h3>
          <p>
            Requirements, conversations, evidence and payments — right where
            they belong.
          </p>
          <Link
            href={featured ? `/requests/${featured.id}` : "/requests/new"}
            className="text-link"
          >
            Explore a request
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
      <div className="overview-payment-footer">
        <PayPalBrand />
        <span>PayPal Sandbox integration · payments require your approval</span>
      </div>
    </div>
  );
}
export function ActivityList({
  limit,
  requestId,
}: {
  limit?: number;
  requestId?: string;
}) {
  const { data } = useWorkspace();
  const activity = data.activity
    .filter((a) => !requestId || a.request_id === requestId)
    .slice(0, limit);
  return activity.length ? (
    <div className="activity-list">
      {activity.map((a) => {
        const Icon =
          a.type === "file" || a.type === "submission"
            ? FileText
            : a.type === "payment"
              ? CreditCard
              : a.type === "supplier"
                ? UsersIcon
                : CheckCircle2;
        const r = data.requests.find((r) => r.id === a.request_id);
        return (
          <div className="activity-item" key={a.id}>
            <span
              className={`activity-icon ${/review|analysis/.test(a.type) ? "activity-amber" : ""}`}
            >
              <Icon size={16} />
            </span>
            <div>
              <p>{a.message}</p>
              <span>
                {r ? (
                  <Link href={`/requests/${r.id}`}>
                    {r.code} · {r.title}
                  </Link>
                ) : (
                  "Workspace"
                )}
                <i>·</i>
                {relative(a.created_at)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  ) : (
    <Empty
      title="The story starts here"
      description="Your requests, files, agreements and decisions will appear in this audit trail."
    />
  );
}
function UsersIcon(props: React.ComponentProps<typeof Package>) {
  return <Package {...props} />;
}
export function RequestsPage() {
  const { data } = useWorkspace();
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("All statuses");
  return (
    <div className="page-enter requests-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR PURCHASING WORKSPACE</div>
          <h1>
            Requests<span className="heading-dot">.</span>
          </h1>
          <p>Every order starts with a clear brief.</p>
        </div>
        <Link href="/requests/new" className="btn btn-primary">
          <Plus size={17} />
          New request
        </Link>
      </div>
      <section className="panel">
        <div className="list-toolbar">
          <div className="input-icon">
            <Search size={16} />
            <input
              placeholder="Search requests…"
              aria-label="Filter requests"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter request status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option>All statuses</option>
            {[...new Set(data.requests.map((r) => r.status))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span className="muted">{data.requests.length} requests</span>
        </div>
        <RequestList
          requests={data.requests.filter(
            (r) =>
              `${r.title} ${r.code}`
                .toLowerCase()
                .includes(search.toLowerCase()) &&
              (status === "All statuses" || r.status === status),
          )}
        />
      </section>
    </div>
  );
}
export function ActivityPage() {
  const { data, toast } = useWorkspace();
  function download() {
    const blob = new Blob([JSON.stringify(data.activity, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "procureproof-activity.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Activity exported.");
  }
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ACCOUNTABILITY, BUILT IN</div>
          <h1>
            Activity<span className="heading-dot">.</span>
          </h1>
          <p>
            A permanent record of your requirements, decisions and provider
            updates.
          </p>
        </div>
        <Button variant="secondary" onClick={download}>
          <Download size={16} />
          Export activity
        </Button>
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Workspace history</h2>
          <span className="muted">
            {data.activity.length} recent events · Asia/Kolkata
          </span>
        </div>
        <ActivityList />
      </section>
    </div>
  );
}
export function PaymentsPage() {
  const { data } = useWorkspace();
  const currencies = [...new Set(data.payments.map((p) => p.currency))];
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <div className="eyebrow">EVIDENCE BEFORE PAYMENT</div>
          <h1>
            Payments<span className="heading-dot">.</span>
          </h1>
          <p>
            Clear amounts. Real provider states. Your approval at every stage.
          </p>
        </div>
        <Link href="/settings" className="btn btn-secondary">
          Manage PayPal
          <ArrowUpRight size={16} />
        </Link>
      </div>
      {currencies.map((currency) => (
        <div className="payment-summary" key={currency}>
          <span className="currency-chip">{currency}</span>
          {[
            {
              label: "Agreed stages",
              n: data.payments
                .filter((p) => p.currency === currency)
                .reduce((n, p) => n + p.amount, 0),
            },
            {
              label: "Funds authorized",
              n: data.payments
                .filter(
                  (p) => p.currency === currency && p.status === "Authorized",
                )
                .reduce((n, p) => n + p.amount, 0),
            },
            {
              label: "Captured",
              n: data.payments
                .filter((p) => p.currency === currency && p.capture_id)
                .reduce((n, p) => n + p.amount, 0),
            },
            {
              label: "Refunded",
              n: data.payments
                .filter((p) => p.currency === currency)
                .reduce((n, p) => n + p.refunded, 0),
            },
          ].map((m) => (
            <div key={m.label}>
              <span>{m.label}</span>
              <strong>{money(m.n, currency)}</strong>
            </div>
          ))}
        </div>
      ))}
      <section className="panel">
        <div className="panel-head">
          <h2>Payment stages</h2>
          <Badge tone="blue">PayPal sandbox</Badge>
        </div>
        {data.payments.length ? (
          <div className="table-scroll">
            <table className="simple-table">
              <thead>
                <tr>
                  <th>Request / stage</th>
                  <th>Supplier</th>
                  <th>Agreed amount</th>
                  <th>Provider state</th>
                  <th>Reference</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => {
                  const r = data.requests.find((r) => r.id === p.request_id),
                    a = data.agreements.find((a) => a.id === p.agreement_id),
                    s = data.suppliers.find((s) => s.id === a?.supplier_id);
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{r?.title}</strong>
                        <small>{a?.stage}</small>
                      </td>
                      <td>{s?.company}</td>
                      <td className="money">{money(p.amount, p.currency)}</td>
                      <td>
                        <Status value={p.status} />
                      </td>
                      <td>
                        <span className="ref-number">
                          {p.capture_id ||
                            p.authorization_id ||
                            p.order_id ||
                            "No provider reference"}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/requests/${p.request_id}?tab=payments`}
                          className="text-link"
                        >
                          Review
                          <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No payments yet"
            description="Select a written quotation to create an agreement and payment stage."
          />
        )}
      </section>
    </div>
  );
}
