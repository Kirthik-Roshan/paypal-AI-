"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  FileText,
  Paperclip,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import type { IntakeConfig, RequestIntake } from "@/lib/request-intake";
import { jsonFetch, useWorkspace } from "./context";
import { Badge, Button, Field, Notice } from "./ui";
import {
  normalizeSupplierPhone,
  supplierContactIssue,
} from "@/lib/supplier-contact";

export function RequestConversation() {
  const { data, refresh, uploadFile, toast } = useWorkspace();
  const router = useRouter(),
    params = useSearchParams();
  const [state, setState] = useState<RequestIntake | null>(null),
    [config, setConfig] = useState<IntakeConfig | null>(null),
    [configured, setConfigured] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [useFiles, setUseFiles] = useState(false),
    [approved, setApproved] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const errorSummary = useRef<HTMLDivElement>(null);
  const initial = useRef(false),
    file = useRef<HTMLInputElement>(null),
    log = useRef<HTMLDivElement>(null);
  const key = `pp-intake:${data.workspace.id}`;
  async function post(action: string, requestId?: string, body?: unknown) {
    return jsonFetch("/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, requestId, data: body }),
    });
  }
  function adopt(value: RequestIntake) {
    setState(value);
    setConfig(value.config);
    localStorage.setItem(key, value.requestId);
  }
  useEffect(() => {
    if (initial.current) return;
    initial.current = true;
    void (async () => {
      try {
        const requested = params.get("draft");
        const saved = localStorage.getItem(key);
        const rid =
          requested ||
          (data.requests.some((r) => r.id === saved && !r.version)
            ? saved
            : undefined);
        const result = await post("create", rid || undefined);
        adopt(result.intake);
        const health = await jsonFetch("/api/intake");
        setConfigured(health.configured);
        await refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    })(); /* Initial workspace-scoped intake only. */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [state?.messages.length]);
  function update<K extends keyof IntakeConfig>(
    key: K,
    value: IntakeConfig[K],
  ) {
    setConfig((c) => (c ? { ...c, [key]: value } : c));
    setApproved(false);
  }
  async function perform(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
      requestAnimationFrame(() => {
        const invalid = document.querySelector<HTMLElement>(
          '.intake-fields [aria-invalid="true"]',
        );
        const target = invalid || errorSummary.current;
        target?.focus();
        target?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    } finally {
      setBusy("");
    }
  }
  async function save(confirm = false) {
    if (!state || !config) return;
    setValidationAttempted(true);
    const invalid = config.suppliers
      .map((supplier, index) => ({
        index,
        issue: supplierContactIssue(supplier),
      }))
      .find((item) => item.issue);
    if (invalid)
      throw Error(`Supplier ${invalid.index + 1}: ${invalid.issue!.message}`);
    const cleanConfig = {
      ...config,
      suppliers: config.suppliers.map((s) => ({
        ...s,
        name: s.name.trim(),
        phone: normalizeSupplierPhone(s.phone),
        email: s.email.trim(),
      })),
    };
    const result = await post("save", state.requestId, {
      config: cleanConfig,
      revision: state.revision,
      confirm,
    });
    adopt(result.intake);
    await refresh();
    if (confirm) {
      localStorage.removeItem(key);
      toast("Request confirmed. Your suppliers and requirements are ready.");
      router.push(`/requests/${state.requestId}?tab=suppliers`);
    } else toast("Request draft saved.");
  }
  const files = data.assets.filter(
    (a) => a.request_id === state?.requestId && a.role === "Buyer context",
  );
  return (
    <div className="page-enter intake-page">
      <Link className="back-link" href="/requests">
        <ArrowLeft size={15} />
        All requests
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            PURCHASING FOR {data.workspace.name.toUpperCase()}
          </div>
          <h1>Let’s build your request.</h1>
          <p>
            Tell your assistant what you need. Review the details as they take
            shape.
          </p>
        </div>
        <Badge tone="green">Draft · review before confirming</Badge>
      </div>
      {error && (
        <div role="alert" ref={errorSummary} tabIndex={-1}>
          <Notice tone="red">{error}</Notice>
        </div>
      )}
      {!state || !config ? (
        <section className="panel panel-body">
          Opening your purchasing assistant…
        </section>
      ) : (
        <div className="intake-layout">
          <section className="panel intake-chat">
            <div className="panel-head">
              <div className="section-title">
                <span className="demo-bot">
                  <Bot size={21} />
                </span>
                <div>
                  <h2>Your purchasing assistant</h2>
                  <small>Describe, attach, refine.</small>
                </div>
              </div>
              <Badge tone={configured ? "green" : "amber"}>
                {configured ? "OpenAI configured" : "AI setup required"}
              </Badge>
            </div>
            <div
              ref={log}
              className="demo-messages intake-messages"
              role="log"
              aria-label="Request conversation"
              aria-live="polite"
            >
              {state.messages.map((m, i) => (
                <div key={i} className={`demo-message ${m.role}`}>
                  <span className="demo-message-avatar">
                    {m.role === "assistant" ? <Bot size={16} /> : "YOU"}
                  </span>
                  <div>
                    <small>
                      {m.role === "assistant" ? "ProcureProof" : "You"}
                    </small>
                    <p>{m.text}</p>
                  </div>
                </div>
              ))}
            </div>
            {!configured && (
              <div className="intake-setup">
                <Notice>
                  Connect OpenAI in Settings to infer details from your messages
                  and files. You can fill the request form manually now.
                </Notice>
              </div>
            )}
            <form
              className="demo-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void perform("chat", async () => {
                  const sent = message;
                  const result = await post("chat", state.requestId, {
                    message: sent,
                    config,
                    revision: state.revision,
                    useFiles,
                  });
                  adopt(result.intake);
                  setMessage((v) => (v === sent ? "" : v));
                  await refresh();
                });
              }}
            >
              {!!files.length && (
                <div className="demo-file-chips">
                  {files.map((f) => (
                    <a
                      key={f.id}
                      href={`/api/assets/${f.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileText size={14} />
                      {f.name}
                    </a>
                  ))}
                </div>
              )}
              <label className="sr-only" htmlFor="request-chat-message">
                Message your purchasing assistant
              </label>
              <textarea
                id="request-chat-message"
                rows={4}
                required
                maxLength={5000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="I need 80 cases of soft drinks for my hypermart. Our regular supplier is Prithish…"
              />
              <div className="demo-compose-tools">
                <input
                  ref={file}
                  type="file"
                  className="sr-only"
                  aria-label="Attach request context"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      void perform("upload", async () => {
                        await uploadFile(state.requestId, f, "Buyer context");
                        setUseFiles(true);
                        if (file.current) file.current.value = "";
                      });
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!!busy}
                  onClick={() => file.current?.click()}
                >
                  <Paperclip size={16} />
                  Attach document or photo
                </Button>
                <Button
                  type="submit"
                  busy={busy === "chat"}
                  disabled={!!busy || !message.trim()}
                >
                  <Send size={16} />
                  Send
                </Button>
              </div>
              {!!files.length && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={useFiles}
                    onChange={(e) => setUseFiles(e.target.checked)}
                  />
                  <span>
                    Include my latest 3 private context files in this OpenAI
                    request.
                  </span>
                </label>
              )}
              <small>
                Private buyer context · PDF or image · 10 MB per file. Supplier
                offers and payments appear only after actual actions.
              </small>
            </form>
            <div className="intake-chat-footer">
              <CheckCircle2 size={16} />
              <span>
                You confirm the brief before supplier outreach begins.
              </span>
            </div>
          </section>
          <section className="panel intake-form">
            <div className="panel-head">
              <div>
                <h2>Your request brief</h2>
                <p>Editable details, kept alongside the conversation.</p>
              </div>
              <Badge>English available</Badge>
            </div>
            <fieldset disabled={!!busy} className="panel-body intake-fields">
              <Field label="Request title" required>
                <input
                  value={config.title}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder="Soft-drink inventory restock"
                  maxLength={150}
                />
              </Field>
              <div className="demo-field-pair">
                <Field label="Category">
                  <input
                    list="intake-categories"
                    value={config.category}
                    onChange={(e) => update("category", e.target.value)}
                    maxLength={100}
                  />
                  <datalist id="intake-categories">
                    {[
                      "General goods",
                      "Beverage wholesale",
                      "Food, beverages & grocery",
                      "Inventory restock",
                      "Office supplies",
                      "Equipment & electronics",
                      "Custom packaging",
                      "Professional services",
                    ].map((c) => (
                      <option value={c} key={c} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Business">
                  <input
                    value={config.business}
                    onChange={(e) => update("business", e.target.value)}
                    maxLength={100}
                  />
                </Field>
              </div>
              <Field
                label="What do you need?"
                required
                hint="Product requirements shared with suppliers; keep private budgets out of this description."
              >
                <textarea
                  rows={3}
                  value={config.description}
                  onChange={(e) => update("description", e.target.value)}
                  maxLength={3000}
                />
              </Field>
              <div className="demo-field-pair">
                <Field label="Quantity" required>
                  <input
                    type="number"
                    min={1}
                    max={1000000}
                    value={config.quantity || ""}
                    onChange={(e) => update("quantity", Number(e.target.value))}
                  />
                </Field>
                <Field label="Unit">
                  <input
                    list="intake-units"
                    value={config.unit}
                    onChange={(e) => update("unit", e.target.value)}
                    maxLength={40}
                  />
                  <datalist id="intake-units">
                    {[
                      "items",
                      "cases",
                      "cartons",
                      "bottles",
                      "cans",
                      "packs",
                      "kilograms",
                      "litres",
                      "pieces",
                      "boxes",
                      "hours",
                    ].map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </Field>
              </div>
              <Field label="Pack size / specification">
                <input
                  value={config.packSize}
                  onChange={(e) => update("packSize", e.target.value)}
                  placeholder="24 × 250 ml cans per case"
                  maxLength={200}
                />
              </Field>
              <Field label="Product mix">
                <textarea
                  rows={2}
                  value={config.productMix}
                  onChange={(e) => update("productMix", e.target.value)}
                  placeholder="40 Coca-Cola, 20 Sprite, 20 Fanta Orange"
                  maxLength={1000}
                />
              </Field>
              <Field label="Delivery address" required>
                <textarea
                  rows={2}
                  value={config.destination}
                  onChange={(e) => update("destination", e.target.value)}
                  maxLength={500}
                />
              </Field>
              <div className="demo-field-pair">
                <Field label="Delivery deadline" required>
                  <input
                    type="date"
                    value={config.deadline}
                    onChange={(e) => update("deadline", e.target.value)}
                  />
                </Field>
                <Field label="Call language">
                  <select
                    value={config.language}
                    onChange={(e) =>
                      update(
                        "language",
                        e.target.value as IntakeConfig["language"],
                      )
                    }
                  >
                    {[
                      "English",
                      "Tamil",
                      "Hindi",
                      "Telugu",
                      "Malayalam",
                      "Kannada",
                    ].map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="demo-field-pair">
                <Field label="Currency">
                  <select
                    value={config.currency}
                    onChange={(e) =>
                      update(
                        "currency",
                        e.target.value as IntakeConfig["currency"],
                      )
                    }
                  >
                    {["USD", "INR", "EUR", "GBP", "AUD", "CAD"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Total budget" required>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={config.budget ? config.budget / 100 : ""}
                    onChange={(e) =>
                      update("budget", Math.round(Number(e.target.value) * 100))
                    }
                  />
                </Field>
              </div>
              <div className="intake-supplier-heading">
                <h3>Supplier contacts</h3>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={config.suppliers.length >= 10}
                  onClick={() =>
                    update("suppliers", [
                      ...config.suppliers,
                      {
                        name: "",
                        phone: "",
                        email: "",
                        relationship: config.suppliers.length
                          ? "Newly discovered"
                          : "Regular",
                      },
                    ])
                  }
                >
                  <Plus size={15} />
                  Add supplier
                </Button>
              </div>
              {!config.suppliers.length && (
                <p className="muted">
                  Tell the assistant who you usually buy from, or add a supplier
                  here.
                </p>
              )}
              {config.suppliers.map((s, i) => (
                <div key={i} className="intake-supplier">
                  <div className="demo-field-pair">
                    <Field label={`Supplier ${i + 1} name`}>
                      <input
                        value={s.name}
                        aria-invalid={
                          (validationAttempted &&
                            supplierContactIssue(s)?.field === "name") ||
                          undefined
                        }
                        onChange={(e) =>
                          update(
                            "suppliers",
                            config.suppliers.map((v, j) =>
                              j === i ? { ...v, name: e.target.value } : v,
                            ),
                          )
                        }
                        maxLength={100}
                      />
                    </Field>
                    <Field label={`Supplier ${i + 1} relationship`}>
                      <select
                        value={s.relationship}
                        onChange={(e) =>
                          update(
                            "suppliers",
                            config.suppliers.map((v, j) =>
                              j === i
                                ? {
                                    ...v,
                                    relationship: e.target
                                      .value as typeof s.relationship,
                                  }
                                : v,
                            ),
                          )
                        }
                      >
                        {["Regular", "Previously used", "Newly discovered"].map(
                          (v) => (
                            <option key={v}>{v}</option>
                          ),
                        )}
                      </select>
                    </Field>
                  </div>
                  <Field
                    label={`Supplier ${i + 1} phone`}
                    hint={
                      validationAttempted &&
                      supplierContactIssue(s)?.field === "phone"
                        ? supplierContactIssue(s)!.message
                        : "Country code required, e.g. +91 followed by the actual number."
                    }
                  >
                    <input
                      type="tel"
                      value={s.phone}
                      aria-invalid={
                        (validationAttempted &&
                          supplierContactIssue(s)?.field === "phone") ||
                        undefined
                      }
                      onChange={(e) =>
                        update(
                          "suppliers",
                          config.suppliers.map((v, j) =>
                            j === i ? { ...v, phone: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label={`Supplier ${i + 1} email`}>
                    <input
                      type="email"
                      value={s.email}
                      aria-invalid={
                        (validationAttempted &&
                          supplierContactIssue(s)?.field === "email") ||
                        undefined
                      }
                      onChange={(e) =>
                        update(
                          "suppliers",
                          config.suppliers.map((v, j) =>
                            j === i ? { ...v, email: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      update(
                        "suppliers",
                        config.suppliers.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 size={14} />
                    Remove supplier
                  </Button>
                </div>
              ))}
              <Field label="Stock / quality requirements">
                <textarea
                  rows={2}
                  value={config.stockRequirements}
                  onChange={(e) => update("stockRequirements", e.target.value)}
                  placeholder="Sealed cases; at least six months before expiry"
                  maxLength={1000}
                />
              </Field>
              <Field label="Negotiable">
                <textarea
                  rows={2}
                  value={config.negotiable}
                  onChange={(e) => update("negotiable", e.target.value)}
                  maxLength={1000}
                />
              </Field>
              <Field label="Ask owner before changing">
                <textarea
                  rows={2}
                  value={config.askOwner}
                  onChange={(e) => update("askOwner", e.target.value)}
                  maxLength={1000}
                />
              </Field>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                />
                <span>
                  I reviewed these requirements and supplier contacts.
                  Confirming freezes this version; calls and payments require
                  separate approval.
                </span>
              </label>
              <div className="demo-actions">
                <Button
                  type="button"
                  variant="secondary"
                  busy={busy === "save"}
                  onClick={() => void perform("save", () => save())}
                >
                  Save draft
                </Button>
                <Button
                  type="button"
                  busy={busy === "confirm"}
                  disabled={!approved}
                  onClick={() => void perform("confirm", () => save(true))}
                >
                  Confirm request
                  <CheckCircle2 size={16} />
                </Button>
              </div>
            </fieldset>
          </section>
        </div>
      )}
    </div>
  );
}
