"use client";
import { defaultSpec } from "@/lib/defaults";
import { date, money } from "@/lib/format";
import type { RequestSpec } from "@/lib/types";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  CloudUpload,
  FileText,
  Globe,
  LoaderCircle,
  Package,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "./context";
import { SupplierForm } from "./suppliers";
import { Badge, Button, Field, FileIcon, Notice } from "./ui";
const steps = [
  "What do you need?",
  "Files & references",
  "Budget & delivery",
  "Suppliers & outreach",
  "Review & confirm",
];
const categorySuggestions = [
  "General goods",
  "Food, beverages & grocery",
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
const unitSuggestions = [
  "items",
  "cases",
  "cartons",
  "crates",
  "packs",
  "bottles",
  "cans",
  "kilograms",
  "litres",
  "pallets",
  "pieces",
  "boxes",
  "rolls",
  "sets",
  "hours",
  "services",
];
export function NewRequest() {
  const { data, action, uploadFile, toast } = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const storageKey = `pp-draft:${data.workspace.id}`;
  const [draft] = useState(() => {
    const existing = data.requests.find(
      (r) => r.id === params.get("draft") && r.version === 0,
    );
    if (existing)
      return {
        id: existing.id,
        title: existing.title,
        category: existing.category,
        spec: existing.spec,
      };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      return saved &&
        (!saved.id ||
          data.requests.some((r) => r.id === saved.id && r.version === 0))
        ? saved
        : null;
    } catch {
      return null;
    }
  });
  const legacyBlankDraft =
    draft &&
    !draft.id &&
    !draft.title?.trim() &&
    !draft.spec?.description?.trim() &&
    draft.category === "Custom packaging";
  const [title, setTitle] = useState<string>(draft?.title || ""),
    [category, setCategory] = useState<string>(
      legacyBlankDraft ? "General goods" : draft?.category || "General goods",
    ),
    [spec, setSpec] = useState<RequestSpec>(
      legacyBlankDraft
        ? { ...defaultSpec(), timezone: data.workspace.timezone }
        : draft?.spec || {
            ...defaultSpec(),
            timezone: data.workspace.timezone,
          },
    ),
    [step, setStep] = useState(0),
    [saving, setSaving] = useState(false),
    [savedAt, setSavedAt] = useState(""),
    [error, setError] = useState(""),
    [role, setRole] = useState("Original logo"),
    [uploading, setUploading] = useState(false),
    [adding, setAdding] = useState(false),
    [approved, setApproved] = useState(false),
    [requestId, setRequestId] = useState<string>(draft?.id || "");
  const rid = useRef<string>(draft?.id || "");
  const inFlight = useRef<Promise<any> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const update = <K extends keyof RequestSpec>(key: K, value: RequestSpec[K]) =>
    setSpec((s) => ({ ...s, [key]: value }));
  async function persist(confirm = false) {
    if (title.trim().length < 3)
      throw Error("Give your request a name with at least 3 characters.");
    if (inFlight.current) await inFlight.current;
    setSaving(true);
    const p = action("request.save", undefined, {
      ...(rid.current ? { id: rid.current } : {}),
      title,
      category,
      spec,
      confirm,
    });
    inFlight.current = p;
    try {
      const result = await p;
      rid.current = result.id;
      setRequestId(result.id);
      setSavedAt(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      localStorage.setItem(
        storageKey,
        JSON.stringify({ id: result.id, title, category, spec }),
      );
      return result;
    } finally {
      inFlight.current = null;
      setSaving(false);
    }
  }
  const signature = JSON.stringify({ title, category, spec });
  useEffect(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ id: rid.current, title, category, spec }),
    );
    if (title.trim().length < 3) return;
    const timer = setTimeout(() => {
      void persist().catch((e) => setError((e as Error).message));
    }, 1500);
    return () => clearTimeout(timer); /* Autosave only on form changes. */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  async function next() {
    setError("");
    if (step === 0 && (!title.trim() || !spec.description.trim())) {
      setError("Add a request name and tell suppliers what you need.");
      return;
    }
    if (step === 2 && !spec.destination.trim()) {
      setError("Add a delivery destination.");
      return;
    }
    try {
      await persist();
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function submit() {
    if (!approved) {
      setError("Confirm the requirements and outreach limits below.");
      return;
    }
    setError("");
    try {
      const result = await persist(true);
      localStorage.removeItem(storageKey);
      toast("Requirements confirmed. Your supplier journey is ready.");
      router.push(`/requests/${result.id}?tab=suppliers`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const r = await persist();
      for (const file of Array.from(files)) await uploadFile(r.id, file, role);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  const assets = data.assets.filter((a) => a.request_id === requestId);
  const packaging = /packaging|printed label|stationery|merchandise/i.test(
    category,
  );
  const grocery = /food|beverage|grocery|inventory restock/i.test(category);
  const categoryFields = grocery
    ? {
        dimensions: "Pack dimensions or storage needs",
        dimensionsHint:
          "Optional: case dimensions, refrigeration or storage constraints.",
        dimensionsPlaceholder: "e.g. Ambient storage; case under 40 cm wide",
        material: "Pack size / configuration",
        materialPlaceholder: "e.g. 24 × 250 ml cans per case",
        colour: "Brand, flavour or variant mix",
        colourPlaceholder: "e.g. Coca-Cola, Sprite and Fanta Orange",
        exactText: "Exact SKU, barcode or product identifier",
        exactTextHint: "Use this only when the exact identifier must match.",
        exactTextPlaceholder: "Optional SKU, EAN, UPC or exact product name",
        requiredElement: "Quality, expiry or condition requirements",
        requiredElementPlaceholder:
          "e.g. Sealed cases; at least 6 months before expiry",
      }
    : packaging
      ? {
          dimensions: "Dimensions, including units",
          dimensionsHint: "Use explicit units, such as mm, cm or inches.",
          dimensionsPlaceholder: "200 × 120 × 80 mm",
          material: "Material",
          materialPlaceholder: "Food-safe kraft, 350 gsm",
          colour: "Colour / finish",
          colourPlaceholder: "Forest green on natural kraft",
          exactText: "Exact printed text / phone number",
          exactTextHint:
            "This text will be checked exactly. Include important punctuation.",
          exactTextPlaceholder: "The exact words or number that must appear",
          requiredElement: "Required element or wording",
          requiredElementPlaceholder: "e.g. PLEASE RECYCLE",
        }
      : {
          dimensions: "Size, dimensions or service scope",
          dimensionsHint:
            "Optional measurements, capacity, duration or coverage.",
          dimensionsPlaceholder: "e.g. 15-inch; 10 kg; 20 support hours",
          material: "Specification, make, model or grade",
          materialPlaceholder:
            "Describe the technical or quality specification",
          colour: "Variant, colour or configuration",
          colourPlaceholder: "Optional variant, size, colour or configuration",
          exactText: "Exact model, SKU or required wording",
          exactTextHint:
            "Use this only when an exact identifier or phrase must match.",
          exactTextPlaceholder: "Optional model number, SKU or exact wording",
          requiredElement: "Quality, compliance or acceptance requirements",
          requiredElementPlaceholder:
            "e.g. Warranty, certification or condition requirement",
        };
  const missingProductDetails = (
    grocery
      ? [
          !spec.material && "pack size or configuration",
          !spec.requiredElement && "quality or expiry requirements",
        ]
      : packaging
        ? [
            !spec.dimensions && "dimensions",
            !spec.material && "material",
            !spec.exactText && "exact printed text",
          ]
        : [!spec.material && "specification, model or grade"]
  ).filter(Boolean);
  return (
    <div className="page-enter new-request-page">
      <Link href="/requests" className="back-link">
        <ArrowLeft size={15} />
        All requests
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A CLEAR BRIEF MAKES ALL THE DIFFERENCE</div>
          <h1>
            Let’s get it right<span className="heading-dot">.</span>
          </h1>
          <p>Tell us what you need. We’ll keep every detail connected.</p>
        </div>
        <span className="autosave-indicator">
          {saving ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <CheckCircle2 size={15} />
          )}{" "}
          {saving
            ? "Saving draft…"
            : savedAt
              ? `Saved at ${savedAt}`
              : "Your draft saves automatically"}
        </span>
      </div>
      <ol className="request-stepper">
        {steps.map((s, i) => (
          <li
            key={s}
            className={`${i === step ? "step-active" : ""} ${i < step ? "step-complete" : ""}`}
          >
            <button
              onClick={() => {
                if (i < step) setStep(i);
              }}
              disabled={i > step}
              aria-current={i === step ? "step" : undefined}
            >
              <span>{i < step ? <Check size={14} /> : i + 1}</span>
              <strong>{s}</strong>
            </button>
          </li>
        ))}
      </ol>
      <div className="request-form-layout">
        <section className="panel request-form-panel">
          <div className="form-section-heading">
            <span className="section-kicker">STEP {step + 1} OF 5</span>
            <h2>{steps[step]}</h2>
            <p>
              {
                [
                  "The details that turn an idea into a shared understanding.",
                  "Share what matters. Keep references separate from requirements.",
                  "Set a clear ceiling and leave no delivery costs hidden.",
                  "Bring your regulars, and set boundaries for new conversations.",
                  "A shared brief, ready to send to the right suppliers.",
                ][step]
              }
            </p>
          </div>
          <div className="request-form-body">
            {step === 0 && (
              <div className="form-grid">
                <div className="form-full">
                  <Field label="Request name" required>
                    <input
                      autoFocus
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Soft-drink inventory restock"
                      maxLength={150}
                    />
                  </Field>
                </div>
                <div className="form-full">
                  <Field label="What are you ordering?" required>
                    <textarea
                      value={spec.description}
                      onChange={(e) => update("description", e.target.value)}
                      placeholder="Describe the product, how you’ll use it, and what a good result looks like…"
                      rows={4}
                    />
                  </Field>
                </div>
                <Field label="Category">
                  <input
                    list="request-category-options"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Choose or type any category"
                    maxLength={100}
                  />
                  <datalist id="request-category-options">
                    {categorySuggestions.map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                </Field>
                <div className="form-grid quantity-grid">
                  <Field label="Quantity" required>
                    <input
                      type="number"
                      min={1}
                      max={1000000}
                      value={spec.quantity}
                      onChange={(e) =>
                        update("quantity", Number(e.target.value))
                      }
                    />
                  </Field>
                  <Field label="Unit">
                    <input
                      list="request-unit-options"
                      value={spec.unit}
                      onChange={(e) => update("unit", e.target.value)}
                      maxLength={40}
                      placeholder="e.g. cases"
                    />
                    <datalist id="request-unit-options">
                      {unitSuggestions.map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  </Field>
                </div>
                <Field
                  label={categoryFields.dimensions}
                  hint={categoryFields.dimensionsHint}
                >
                  <input
                    value={spec.dimensions}
                    onChange={(e) => update("dimensions", e.target.value)}
                    placeholder={categoryFields.dimensionsPlaceholder}
                  />
                </Field>
                <Field label={categoryFields.material}>
                  <input
                    value={spec.material}
                    onChange={(e) => update("material", e.target.value)}
                    placeholder={categoryFields.materialPlaceholder}
                  />
                </Field>
                <Field label={categoryFields.colour}>
                  <input
                    value={spec.colour}
                    onChange={(e) => update("colour", e.target.value)}
                    placeholder={categoryFields.colourPlaceholder}
                  />
                </Field>
                <Field label="Needed by" required>
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={spec.deadline}
                    onChange={(e) => update("deadline", e.target.value)}
                  />
                </Field>
                <div className="form-full">
                  <Field
                    label={categoryFields.exactText}
                    hint={categoryFields.exactTextHint}
                  >
                    <textarea
                      value={spec.exactText}
                      onChange={(e) => update("exactText", e.target.value)}
                      rows={2}
                      placeholder={categoryFields.exactTextPlaceholder}
                    />
                  </Field>
                </div>
                <div className="form-full">
                  <Field label={categoryFields.requiredElement}>
                    <input
                      value={spec.requiredElement}
                      onChange={(e) =>
                        update("requiredElement", e.target.value)
                      }
                      placeholder={categoryFields.requiredElementPlaceholder}
                    />
                  </Field>
                </div>
              </div>
            )}
            {step === 1 && (
              <>
                <div className="upload-role">
                  <Field label="This file is">
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      <option>Original logo</option>
                      <option>Reference only</option>
                      <option>Required artwork</option>
                      <option>Specification</option>
                    </select>
                  </Field>
                </div>
                <div
                  className={`dropzone ${uploading ? "dropzone-busy" : ""}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void handleFiles(e.dataTransfer.files);
                  }}
                >
                  <span className="upload-cloud">
                    {uploading ? (
                      <LoaderCircle size={29} className="spin" />
                    ) : (
                      <CloudUpload size={29} strokeWidth={1.5} />
                    )}
                  </span>
                  <h3>
                    {uploading
                      ? "Storing your files securely…"
                      : "A little reference goes a long way."}
                  </h3>
                  <p>Drag files here, or choose from your device.</p>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    multiple
                    aria-label="Upload request files"
                    onChange={(e) => void handleFiles(e.target.files)}
                    className="sr-only"
                  />
                  <Button
                    variant="secondary"
                    disabled={uploading}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Plus size={15} />
                    Choose files
                  </Button>
                  <small>PDF, PNG, JPEG, WebP · Up to 10 MB each</small>
                </div>
                <div className="asset-list">
                  {assets.map((a) => (
                    <div className="asset-row" key={a.id}>
                      <FileIcon />
                      <div>
                        <a
                          href={`/api/assets/${a.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {a.name}
                        </a>
                        <span>
                          {a.role} · {(a.size / 1024).toFixed(0)} KB · Uploaded
                        </span>
                      </div>
                      <button
                        aria-label={`Remove ${a.name}`}
                        className="icon-btn"
                        onClick={() =>
                          void action(
                            "asset.remove",
                            undefined,
                            { assetId: a.id },
                            "File removed.",
                          ).catch(() => {})
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <Field
                  label={
                    grocery
                      ? "What stock or delivery evidence matters?"
                      : packaging
                        ? "What visual features matter?"
                        : "What evidence or acceptance details matter?"
                  }
                  hint={
                    grocery
                      ? "Describe what you will inspect, such as seals, expiry dates, case count or delivered condition."
                      : packaging
                        ? "A reference photo is inspiration unless you explicitly make a feature a requirement."
                        : "Describe documents, photos, certifications or checks needed before acceptance."
                  }
                >
                  <textarea
                    value={spec.visualNotes}
                    onChange={(e) => update("visualNotes", e.target.value)}
                    rows={4}
                    placeholder={
                      grocery
                        ? "e.g. Verify sealed cases, expiry dates, delivered quantity and undamaged cans."
                        : packaging
                          ? "e.g. Keep the logo proportions and generous spacing."
                          : "e.g. Require serial-number photos, warranty certificate and delivery checklist."
                    }
                  />
                </Field>
                <Notice tone="neutral">
                  {grocery
                    ? "Documents and photos support review, but physical quantity, freshness and condition still need your inspection."
                    : packaging
                      ? "Exact text is checked separately. Logo appearance and subjective design choices need your visual review."
                      : "Files support the decision trail. Physical condition and subjective quality still need human review."}
                </Notice>
              </>
            )}
            {step === 2 && (
              <div className="form-grid">
                <Field label="Currency">
                  <select
                    value={spec.currency}
                    onChange={(e) => update("currency", e.target.value)}
                  >
                    {["USD", "INR", "EUR", "GBP", "AUD", "CAD"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Maximum total budget" required>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={spec.budget / 100}
                    onChange={(e) =>
                      update("budget", Math.round(Number(e.target.value) * 100))
                    }
                  />
                </Field>
                <div className="form-full check-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={spec.taxIncluded}
                      onChange={(e) => update("taxIncluded", e.target.checked)}
                    />
                    <span>My total budget includes taxes</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={spec.shippingIncluded}
                      onChange={(e) =>
                        update("shippingIncluded", e.target.checked)
                      }
                    />
                    <span>My total budget includes shipping and delivery</span>
                  </label>
                  <p className="field-hint">
                    Every supplier must specify tax and shipping, including a
                    confirmed zero. Unknown costs remain unknown.
                  </p>
                </div>
                <div className="form-full">
                  <Field label="Delivery destination" required>
                    <textarea
                      value={spec.destination}
                      onChange={(e) => update("destination", e.target.value)}
                      placeholder="City, state/region, country and postal code"
                      rows={3}
                    />
                  </Field>
                </div>
                <div className="form-full">
                  <Field
                    label="Allowed alternatives"
                    hint="Leave blank if the specification must be followed exactly."
                  >
                    <textarea
                      value={spec.alternatives}
                      onChange={(e) => update("alternatives", e.target.value)}
                      placeholder="e.g. Recycled stock of the same weight is acceptable; dimensions must stay the same."
                      rows={3}
                    />
                  </Field>
                </div>
                <div className="form-full">
                  <Notice tone="neutral">
                    Offers in different currencies are compared separately.
                    Import duties and unquoted costs are never assumed to be
                    zero.
                  </Notice>
                </div>
              </div>
            )}
            {step === 3 && (
              <>
                <div className="form-block-heading">
                  <div>
                    <h3>Your regular suppliers</h3>
                    <p>
                      Choose who should receive a private quotation invitation.
                    </p>
                  </div>
                  <Button variant="ghost" onClick={() => setAdding(true)}>
                    <Plus size={15} />
                    Add supplier
                  </Button>
                </div>
                <div className="supplier-select-list">
                  {data.suppliers.map((s) => (
                    <label
                      className={`supplier-select ${spec.supplierIds.includes(s.id) ? "supplier-selected" : ""}`}
                      key={s.id}
                    >
                      <input
                        type="checkbox"
                        checked={spec.supplierIds.includes(s.id)}
                        disabled={s.do_not_contact === 1}
                        onChange={(e) =>
                          update(
                            "supplierIds",
                            e.target.checked
                              ? [...spec.supplierIds, s.id]
                              : spec.supplierIds.filter((id) => id !== s.id),
                          )
                        }
                      />
                      <span className="small-monogram">{s.company[0]}</span>
                      <span>
                        <strong>{s.company}</strong>
                        <small>
                          {s.location || s.category} ·{" "}
                          {s.do_not_contact ? "Do not contact" : s.relationship}
                        </small>
                      </span>
                      <Badge>{s.channel}</Badge>
                    </label>
                  ))}
                </div>
                <label className="toggle-card">
                  <span className="toggle-card-icon">
                    <Globe size={22} />
                  </span>
                  <span>
                    <strong>Find additional suppliers</strong>
                    <small>
                      Explore new options with a clear region and contact limit.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    className="toggle"
                    checked={spec.discover}
                    onChange={(e) => update("discover", e.target.checked)}
                  />
                </label>
                {spec.discover && (
                  <div className="form-grid outreach-fields">
                    <Field label="Delivery region for search">
                      <input
                        value={spec.region}
                        onChange={(e) => update("region", e.target.value)}
                        placeholder="e.g. United States"
                      />
                    </Field>
                    <Field
                      label="Maximum new supplier contacts"
                      hint="A hard ceiling, from 1 to 10."
                    >
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={spec.maxContacts}
                        onChange={(e) =>
                          update("maxContacts", Number(e.target.value))
                        }
                      />
                    </Field>
                  </div>
                )}
                <h3 className="subsection-title">Conversation boundaries</h3>
                <div className="form-grid">
                  <Field label="Preferred language">
                    <select
                      value={spec.language}
                      onChange={(e) => update("language", e.target.value)}
                    >
                      {[
                        "English",
                        "Hindi",
                        "Tamil",
                        "Telugu",
                        "Kannada",
                        "Malayalam",
                      ].map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Preferred channel">
                    <select
                      value={spec.channel}
                      onChange={(e) => update("channel", e.target.value)}
                    >
                      <option>Email</option>
                      <option>Phone</option>
                    </select>
                  </Field>
                  <Field label="Outreach starts">
                    <input
                      type="time"
                      value={spec.outreachStart}
                      onChange={(e) => update("outreachStart", e.target.value)}
                    />
                  </Field>
                  <Field label="Outreach ends">
                    <input
                      type="time"
                      value={spec.outreachEnd}
                      onChange={(e) => update("outreachEnd", e.target.value)}
                    />
                  </Field>
                  <div className="form-full">
                    <Field label="Outreach time zone">
                      <select
                        value={spec.timezone}
                        onChange={(e) => update("timezone", e.target.value)}
                      >
                        {[
                          "Asia/Kolkata",
                          "America/Los_Angeles",
                          "America/New_York",
                          "Europe/London",
                          "Australia/Sydney",
                          "UTC",
                        ].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="form-full">
                    <Field label="What can be negotiated?">
                      <textarea
                        value={spec.negotiable}
                        onChange={(e) => update("negotiable", e.target.value)}
                        rows={2}
                      />
                    </Field>
                  </div>
                  <div className="form-full">
                    <Field label="When should we ask you?">
                      <textarea
                        value={spec.askOwner}
                        onChange={(e) => update("askOwner", e.target.value)}
                        rows={2}
                      />
                    </Field>
                  </div>
                </div>
                <Notice tone="neutral">
                  This approves a bounded scope. Calls still require a separate
                  launch, a configured provider and an allowlisted consenting
                  test number.
                </Notice>
              </>
            )}
            {step === 4 && (
              <>
                <div className="review-summary-card">
                  <span className="summary-icon">
                    <ClipboardIcon />
                  </span>
                  <h3>{title}</h3>
                  <p>{spec.description}</p>
                  <dl className="detail-grid">
                    <div>
                      <dt>Quantity</dt>
                      <dd>
                        {spec.quantity.toLocaleString()} {spec.unit}
                      </dd>
                    </div>
                    <div>
                      <dt>{categoryFields.dimensions}</dt>
                      <dd>{spec.dimensions || "Not specified"}</dd>
                    </div>
                    <div>
                      <dt>
                        {grocery
                          ? "Pack / variants"
                          : packaging
                            ? "Material / colour"
                            : "Specification / variant"}
                      </dt>
                      <dd>
                        {spec.material || "Not specified"} /{" "}
                        {spec.colour || "Not specified"}
                      </dd>
                    </div>
                    <div>
                      <dt>Deadline</dt>
                      <dd>{date(spec.deadline, { year: "numeric" })}</dd>
                    </div>
                    <div>
                      <dt>{categoryFields.exactText}</dt>
                      <dd>{spec.exactText || "Not specified"}</dd>
                    </div>
                    <div>
                      <dt>{categoryFields.requiredElement}</dt>
                      <dd>{spec.requiredElement || "Not specified"}</dd>
                    </div>
                    <div>
                      <dt>Maximum total</dt>
                      <dd>{money(spec.budget, spec.currency)}</dd>
                    </div>
                    <div>
                      <dt>Destination</dt>
                      <dd>
                        {spec.destination || "Missing — add a destination"}
                      </dd>
                    </div>
                  </dl>
                </div>
                <h3 className="subsection-title">Approved outreach scope</h3>
                <div className="scope-summary">
                  <p>
                    <Users size={16} />
                    <strong>
                      {spec.supplierIds.length} selected suppliers
                    </strong>
                  </p>
                  {data.suppliers
                    .filter((s) => spec.supplierIds.includes(s.id))
                    .map((s) => (
                      <span key={s.id}>
                        {s.company} ·{" "}
                        {s.email || s.phone || "Contact details needed"}
                      </span>
                    ))}
                  <p>
                    <Globe size={16} />
                    {spec.discover
                      ? `Up to ${spec.maxContacts} additional candidates in ${spec.region || "a region you still need to specify"}`
                      : "No additional supplier search"}
                  </p>
                  <p>
                    <Clock3 size={16} />
                    {spec.outreachStart}–{spec.outreachEnd} · {spec.timezone}
                  </p>
                </div>
                {missingProductDetails.length > 0 && (
                  <Notice>
                    Some product details are unspecified. Suppliers may need to
                    ask about {missingProductDetails.join(", ")}.
                  </Notice>
                )}
                <label className="confirmation-checkbox">
                  <input
                    type="checkbox"
                    checked={approved}
                    onChange={(e) => setApproved(e.target.checked)}
                  />
                  <span>
                    I confirm these requirements and the supplier outreach
                    scope. This freezes requirement version 1. No calls,
                    messages or payment will be made by confirming.
                  </span>
                </label>
              </>
            )}
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
          </div>
          <div className="form-navigation">
            <Button
              variant="secondary"
              disabled={step === 0 || saving}
              onClick={() => setStep((s) => s - 1)}
            >
              <ArrowLeft size={16} />
              Back
            </Button>
            <span>{step + 1} / 5</span>
            {step < 4 ? (
              <Button busy={saving} onClick={() => void next()}>
                Continue
                <ArrowRight size={16} />
              </Button>
            ) : (
              <Button
                busy={saving}
                disabled={!approved}
                onClick={() => void submit()}
              >
                <ShieldCheck size={16} />
                Confirm request
              </Button>
            )}
          </div>
        </section>
        <aside className="request-summary-aside">
          <div className="summary-aside-head">
            <Package size={20} />
            <span>YOUR REQUEST, AT A GLANCE</span>
          </div>
          <h3>{title || "Something good is taking shape."}</h3>
          <p className="summary-description">
            {spec.description ||
              "A few clear details now mean fewer questions later."}
          </p>
          <div className="summary-aside-details">
            <div>
              <span>Category</span>
              <strong>{category}</strong>
            </div>
            <div>
              <span>Quantity</span>
              <strong>
                {spec.quantity.toLocaleString()} {spec.unit}
              </strong>
            </div>
            <div>
              <span>Needed by</span>
              <strong>{date(spec.deadline)}</strong>
            </div>
            <div>
              <span>Budget ceiling</span>
              <strong>{money(spec.budget, spec.currency)}</strong>
            </div>
            <div>
              <span>Files attached</span>
              <strong>{assets.length}</strong>
            </div>
            <div>
              <span>Regular suppliers</span>
              <strong>{spec.supplierIds.length} selected</strong>
            </div>
          </div>
          <div className="summary-reassurance">
            <ShieldCheck size={18} />
            <p>
              You set the boundaries.
              <br />
              Every decision stays traceable.
            </p>
          </div>
        </aside>
      </div>
      {adding && (
        <SupplierForm
          onClose={() => setAdding(false)}
          onSaved={(sid) => update("supplierIds", [...spec.supplierIds, sid])}
        />
      )}
    </div>
  );
}
function ClipboardIcon() {
  return <FileText size={23} />;
}
