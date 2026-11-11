"use client";
import { money } from "@/lib/format";
import type { Supplier } from "@/lib/types";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Globe,
  Mail,
  MapPin,
  Plus,
  Search,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useWorkspace } from "./context";
import { Badge, Button, Empty, Field, Modal } from "./ui";
const supplierCategories = [
  "General goods",
  "Food, beverages & grocery",
  "Beverage wholesale",
  "Inventory restock",
  "Cleaning & maintenance supplies",
  "Office supplies",
  "Equipment & electronics",
  "Professional services",
  "Custom packaging",
  "Printed labels",
  "Branded merchandise",
  "Printed stationery",
];
export function SupplierForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const { action } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);
    try {
      const result = await action(
        "supplier.save",
        undefined,
        data,
        "Supplier saved to your directory.",
      );
      onSaved?.(result.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Add a regular supplier" onClose={onClose} wide>
      <form onSubmit={save}>
        <p className="muted form-intro">
          Keep the people you trust close. Order history will build as you work
          together.
        </p>
        <div className="form-grid">
          <Field label="Company name" required>
            <input
              name="company"
              autoFocus
              required
              minLength={2}
              placeholder="e.g. Evergreen Packaging"
            />
          </Field>
          <Field label="Contact person">
            <input name="contact" placeholder="Full name" />
          </Field>
          <Field label="Email">
            <input name="email" type="email" placeholder="quotes@company.com" />
          </Field>
          <Field
            label="Phone"
            hint="International format, including + and country code"
          >
            <input
              name="phone"
              type="tel"
              pattern="\+[1-9][0-9]{7,14}"
              placeholder="+1…"
            />
          </Field>
          <Field label="Location">
            <input name="location" placeholder="City, country" />
          </Field>
          <Field label="Category">
            <input
              name="category"
              list="supplier-category-options"
              defaultValue="General goods"
              maxLength={100}
              placeholder="Choose or type any category"
            />
            <datalist id="supplier-category-options">
              {supplierCategories.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </Field>
          <Field label="Preferred language">
            <select name="language">
              <option>English</option>
              <option>Hindi</option>
              <option>Tamil</option>
              <option>Telugu</option>
              <option>Kannada</option>
              <option>Malayalam</option>
            </select>
          </Field>
          <Field label="Preferred channel">
            <select name="channel">
              <option>Email</option>
              <option>Phone</option>
            </select>
          </Field>
          <Field label="Website">
            <input name="website" type="url" placeholder="https://" />
          </Field>
          <Field label="Relationship">
            <select name="relationship">
              <option>Regular</option>
              <option>Previously used</option>
              <option>Newly discovered</option>
            </select>
          </Field>
          <div className="form-full">
            <Field label="Your notes">
              <textarea
                name="notes"
                rows={3}
                placeholder="Materials, specialties, or things to remember…"
              />
            </Field>
          </div>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button busy={busy} type="submit">
            <Plus size={16} />
            Save supplier
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function SuppliersPage() {
  const { data, action, toast } = useWorkspace();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All suppliers"),
    [adding, setAdding] = useState(false),
    [selected, setSelected] = useState<Supplier | null>(null),
    [inviteFor, setInviteFor] = useState(""),
    [busy, setBusy] = useState(false),
    [invitation, setInvitation] = useState("");
  const suppliers = data.suppliers.filter(
    (s) =>
      `${s.company} ${s.contact} ${s.location} ${s.category}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "All suppliers" || s.relationship === filter),
  );
  async function createInvite() {
    if (!selected || !inviteFor) return;
    setBusy(true);
    try {
      const r = await action("invitation.create", inviteFor, {
        supplierId: selected.id,
      });
      setInvitation(r.url);
    } catch {
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <div className="eyebrow">GOOD RELATIONSHIPS. BETTER ORDERS.</div>
          <h1>
            Suppliers<span className="heading-dot">.</span>
          </h1>
          <p>
            Your regulars, your new finds, and everything you know about them.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus size={17} />
          Add supplier
        </Button>
      </div>
      <div className="directory-stats">
        <div>
          <Users size={18} />
          <strong>{data.suppliers.length}</strong>
          <span>in your directory</span>
        </div>
        <div>
          <span className="status-dot green-dot" />
          <strong>
            {data.suppliers.filter((s) => s.relationship === "Regular").length}
          </strong>
          <span>regular suppliers</span>
        </div>
        <div>
          <Globe size={18} />
          <strong>
            {
              data.suppliers.filter(
                (s) => s.relationship === "Newly discovered",
              ).length
            }
          </strong>
          <span>newly discovered</span>
        </div>
      </div>
      <div className="directory-toolbar">
        <div className="segmented">
          {[
            "All suppliers",
            "Regular",
            "Previously used",
            "Newly discovered",
          ].map((f) => (
            <button
              key={f}
              className={f === filter ? "selected" : ""}
              aria-pressed={f === filter}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="input-icon">
          <Search size={16} />
          <input
            aria-label="Search suppliers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a supplier…"
          />
        </div>
      </div>
      {suppliers.length ? (
        <div className="supplier-grid">
          {suppliers.map((s, i) => {
            const orders = data.payments.filter(
              (p) =>
                p.capture_id &&
                data.agreements.find((a) => a.id === p.agreement_id)
                  ?.supplier_id === s.id,
            ).length;
            return (
              <button
                className="supplier-card"
                key={s.id}
                onClick={() => {
                  setSelected(s);
                  setInvitation("");
                  setInviteFor("");
                }}
              >
                <div className="supplier-card-head">
                  <span className={`supplier-monogram mono-${i % 3}`}>
                    {s.company
                      .split(" ")
                      .map((t) => t[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <ArrowUpRight size={18} />
                </div>
                <div className="supplier-name-line">
                  <h2>{s.company}</h2>
                  <span
                    className={`relationship ${s.relationship === "Regular" ? "relationship-regular" : ""}`}
                  >
                    {s.relationship}
                  </span>
                </div>
                <p className="supplier-category">{s.category}</p>
                <div className="supplier-location">
                  <MapPin size={14} />
                  {s.location || "Location not specified"}
                </div>
                <div className="supplier-card-contact">
                  <span>
                    <Mail size={14} />
                    {s.email || "Email not added"}
                  </span>
                  <span>
                    <Users size={14} />
                    {s.contact || "Contact not added"}
                  </span>
                </div>
                <div className="supplier-card-foot">
                  <span>
                    {orders
                      ? `${orders} completed ${orders === 1 ? "order" : "orders"}`
                      : "No previous orders"}
                  </span>
                  <Badge tone="neutral">{s.verification}</Badge>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <section className="panel">
          <Empty
            icon={Users}
            title={
              query
                ? "No matching suppliers"
                : "Your next partnership starts here"
            }
            description="Save a regular supplier or discover candidates from a confirmed request."
          >
            <Button onClick={() => setAdding(true)}>
              <Plus size={16} />
              Add supplier
            </Button>
          </Empty>
        </section>
      )}
      <div className="discovery-directory-note">
        <Globe size={22} />
        <div>
          <h3>Make room for new possibilities.</h3>
          <p>
            Find additional suppliers from a request, with a clear region and a
            contact limit you control.
          </p>
        </div>
        <Link href="/requests" className="text-link">
          Open requests
          <ArrowRightIcon />
        </Link>
      </div>
      {adding && <SupplierForm onClose={() => setAdding(false)} />}
      {selected && (
        <Modal title={selected.company} onClose={() => setSelected(null)} wide>
          <div className="detail-badges">
            <Badge tone="green">{selected.relationship}</Badge>
            <Badge>{selected.verification}</Badge>
            {selected.do_not_contact === 1 && (
              <Badge tone="red">Do not contact</Badge>
            )}
          </div>
          <dl className="detail-grid">
            <div>
              <dt>Contact</dt>
              <dd>{selected.contact || "Not added"}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{selected.location || "Not added"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{selected.email || "Not added"}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{selected.phone || "Not added"}</dd>
            </div>
            <div>
              <dt>Preferred outreach</dt>
              <dd>
                {selected.language} · {selected.channel}
              </dd>
            </div>
            <div>
              <dt>Website</dt>
              <dd>
                {selected.website ? (
                  <a
                    href={selected.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link"
                  >
                    Visit website
                    <ArrowUpRight size={13} />
                  </a>
                ) : (
                  "Not added"
                )}
              </dd>
            </div>
          </dl>
          <div className="note-box">
            <span className="field-label">Owner notes</span>
            <p>{selected.notes || "No notes yet."}</p>
          </div>
          <h3 className="subsection-title">Actual order history</h3>
          {data.payments.some(
            (p) =>
              p.capture_id &&
              data.agreements.find((a) => a.id === p.agreement_id)
                ?.supplier_id === selected.id,
          ) ? (
            data.payments
              .filter(
                (p) =>
                  p.capture_id &&
                  data.agreements.find((a) => a.id === p.agreement_id)
                    ?.supplier_id === selected.id,
              )
              .map((p) => (
                <div className="record-row" key={p.id}>
                  {data.requests.find((r) => r.id === p.request_id)?.title}
                  <strong>{money(p.amount, p.currency)}</strong>
                </div>
              ))
          ) : (
            <p className="muted">
              No previous orders. Quotations and sample agreements do not count
              as completed purchases.
            </p>
          )}
          <h3 className="subsection-title">Invite to quote</h3>
          <p className="muted">
            Create a private link. No email or phone call is sent automatically.
          </p>
          <div className="inline-form">
            <select
              aria-label="Choose request for invitation"
              value={inviteFor}
              onChange={(e) => setInviteFor(e.target.value)}
            >
              <option value="">Choose a confirmed request</option>
              {data.requests
                .filter((r) => r.version > 0)
                .map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.title}
                  </option>
                ))}
            </select>
            <Button
              variant="secondary"
              disabled={!inviteFor || selected.do_not_contact === 1}
              busy={busy}
              onClick={() => void createInvite()}
            >
              Create invitation
            </Button>
          </div>
          {invitation && (
            <div className="invitation-created">
              <Check size={18} />
              <div>
                <strong>Invitation ready · expires in 7 days</strong>
                <div className="invitation-actions">
                  <a
                    href={invitation}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link"
                  >
                    Open supplier portal
                    <ArrowUpRight size={14} />
                  </a>
                  <button
                    className="text-link"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(location.origin + invitation)
                        .then(() => toast("Private invitation link copied."))
                        .catch(() =>
                          toast("Open the portal and copy its address.", true),
                        )
                    }
                  >
                    Copy private link
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="modal-actions">
            <Button
              variant="ghost"
              disabled={selected.do_not_contact === 1}
              onClick={() =>
                void action(
                  "supplier.stopContact",
                  undefined,
                  { supplierId: selected.id },
                  "Future outreach disabled.",
                )
                  .then(() => setSelected(null))
                  .catch(() => {})
              }
            >
              Disable future outreach
            </Button>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Done
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ArrowRightIcon() {
  return <ChevronRight size={16} />;
}
