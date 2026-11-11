"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  FileText,
  MapPin,
  MessageSquare,
  Paperclip,
  Phone,
  Send,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Users,
} from "lucide-react";
import type { DemoConfig, DemoSession } from "@/lib/demo";
import { money } from "@/lib/format";
import { quoteProblems } from "@/lib/quote-rules";
import { jsonFetch, useWorkspace } from "./context";
import { Badge, Button, Field, Notice } from "./ui";

type Place = {
  id: string;
  displayName: { text: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  googleMapsUri?: string;
  attributions?: { provider?: string; providerUri?: string }[];
};
export function SupermarketDemo() {
  const { data, refresh, action, toast, uploadFile } = useWorkspace();
  const [demo, setDemo] = useState<DemoSession | null>(null),
    [config, setConfig] = useState<DemoConfig | null>(null),
    [loaded, setLoaded] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [model, setModel] = useState(false),
    [engine, setEngine] = useState(""),
    [useFiles, setUseFiles] = useState(false),
    [consent, setConsent] = useState<Record<string, boolean>>({}),
    [links, setLinks] = useState<Record<string, string>>({}),
    [places, setPlaces] = useState<Place[] | null>(null);
  const file = useRef<HTMLInputElement>(null),
    end = useRef<HTMLDivElement>(null);
  const [paymentContacts, setPaymentContacts] = useState<
    { supplier_id: string; account: string }[]
  >([]);
  const load = useCallback(async () => {
    const result = await jsonFetch("/api/demo");
    setDemo(result.demo);
    setConfig(result.demo?.config || null);
    setModel(result.modelConfigured);
    setPaymentContacts(result.paymentContacts || []);
    setLoaded(true);
  }, []);
  useEffect(() => {
    void load().catch((e) => {
      setError(e.message);
      setLoaded(true);
    });
  }, [load]);
  useEffect(() => {
    if (demo?.messages.length && demo.messages.length > 1)
      end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [demo?.messages.length]);
  async function perform(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      if (name.startsWith("call-")) void refresh();
    }
  }
  async function post(action: string, body?: unknown) {
    return jsonFetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data: body }),
    });
  }
  function adopt(result: { demo: DemoSession }) {
    setDemo(result.demo);
    setConfig(result.demo.config);
  }
  const request = data.requests.find((r) => r.id === demo?.requestId);
  const suppliers = data.suppliers.filter((s) =>
    request?.spec.supplierIds.includes(s.id),
  );
  const files = data.assets.filter(
    (a) => a.request_id === demo?.requestId && a.role === "Buyer context",
  );
  const calls = data.calls.filter((c) => c.request_id === demo?.requestId);
  const quotes = data.quotes
    .filter((q) => q.request_id === demo?.requestId)
    .filter(
      (q, i, arr) =>
        arr.findIndex((v) => v.supplier_id === q.supplier_id) === i,
    );
  const eligible = request
    ? quotes
        .filter((q) => !quoteProblems(q, request).length && q.total !== null)
        .sort((a, b) => a.total! - b.total!)
    : [];
  const agreement = data.agreements.find(
    (a) => a.request_id === demo?.requestId,
  );
  const payment = data.payments.find((p) => p.request_id === demo?.requestId);
  function update<K extends keyof DemoConfig>(key: K, value: DemoConfig[K]) {
    setConfig((c) => (c ? { ...c, [key]: value } : c));
  }
  const stages = [
    { label: "Describe the restock", done: !!demo?.confirmed },
    { label: "Talk to suppliers", done: quotes.length >= 2 },
    { label: "Choose the best deal", done: !!agreement },
    { label: "Review & pay", done: payment?.status === "Captured" },
  ];
  return (
    <div className="demo-page">
      <div className="demo-heading">
        <div>
          <div className="eyebrow">HACKATHON / SUPERMARKET RESTOCK</div>
          <h1>Low stock. Better conversations.</h1>
          <p>One buyer, two teammates, one real procurement journey.</p>
        </div>
        <Badge tone="amber">Demo scenario · real actions require setup</Badge>
      </div>
      <div className="demo-progress">
        {stages.map((s, i) => (
          <div key={s.label} className={s.done ? "done" : ""}>
            <span>{s.done ? <Check size={16} /> : i + 1}</span>
            <div>
              <small>STEP {i + 1}</small>
              <strong>{s.label}</strong>
            </div>
          </div>
        ))}
      </div>
      {error && (
        <div role="alert">
          <Notice tone="red">{error}</Notice>
        </div>
      )}
      {!loaded ? (
        <div className="panel panel-body">Opening your demo…</div>
      ) : !demo ? (
        <section className="demo-intro panel">
          <div className="demo-intro-art">
            <ShoppingBasket size={70} />
            <span className="demo-stock-tag">RESTOCK NEEDED</span>
            <div className="demo-can-row">
              {["COLA", "LIME", "ORANGE"].map((n) => (
                <div key={n} className={`demo-can can-${n.toLowerCase()}`}>
                  <span>FRESH</span>
                  <strong>{n}</strong>
                  <small>SOFT DRINK</small>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Badge tone="green">A story you can drive live</Badge>
            <h2>
              Your shelves are running low.
              <br />
              Tell your purchasing assistant.
            </h2>
            <p>
              Chat naturally, attach documents or photos, and let the assistant
              collect the missing details. Prithish is your usual supplier;
              Karthick is the nearby alternative played by your teammate.
            </p>
            <ul>
              <li>No prewritten quotations or successful payments.</li>
              <li>Your existing requests and business profile stay intact.</li>
              <li>
                Real calls, discovery and sandbox checkout show their setup
                requirements.
              </li>
            </ul>
            <Button
              busy={busy === "start"}
              onClick={() =>
                void perform("start", async () => {
                  adopt(await post("start"));
                  await refresh();
                })
              }
            >
              Start supermarket demo <ArrowRight size={17} />
            </Button>
          </div>
        </section>
      ) : (
        <div className="demo-columns">
          <div className="demo-main">
            <section className="panel demo-chat">
              <div className="panel-head">
                <div className="section-title">
                  <span className="demo-bot">
                    <Bot size={20} />
                  </span>
                  <div>
                    <h2>Your purchasing assistant</h2>
                    <small>
                      {engine ||
                        (model
                          ? "Model intake configured · unverified"
                          : "Local text parser · model setup required")}
                    </small>
                  </div>
                </div>
                <Badge tone="green">Buyer chat</Badge>
              </div>
              <div
                className="demo-messages"
                role="log"
                aria-label="Buyer conversation"
                aria-live="polite"
              >
                {demo.messages.map((m, i) => (
                  <div key={i} className={`demo-message ${m.role}`}>
                    <span className="demo-message-avatar">
                      {m.role === "assistant" ? <Sparkles size={16} /> : "YOU"}
                    </span>
                    <div>
                      <small>
                        {m.role === "assistant" ? "ProcureProof" : "You"}
                      </small>
                      <p>{m.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={end} />
              </div>
              {!demo.confirmed ? (
                <form
                  className="demo-composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void perform("chat", async () => {
                      const result = await post("chat", { message, useFiles });
                      adopt(result);
                      setEngine(result.engine);
                      setMessage((current) =>
                        current === message ? "" : current,
                      );
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
                  <label className="sr-only" htmlFor="demo-message">
                    Message the purchasing assistant
                  </label>
                  <textarea
                    id="demo-message"
                    required
                    maxLength={3000}
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="I run a supermarket. I need 40 cases of cola, 24 × 250 ml cans…"
                  />
                  <div className="demo-compose-tools">
                    <input
                      ref={file}
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      className="sr-only"
                      aria-label="Upload stock document or photo"
                      onChange={(e) => {
                        const selected = e.target.files?.[0];
                        if (selected)
                          void perform("upload", async () => {
                            await uploadFile(
                              demo.requestId,
                              selected,
                              "Buyer context",
                            );
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
                      <Paperclip size={17} />
                      Attach file
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
                        Include my latest 3 context files in this turn’s model
                        request.
                      </span>
                    </label>
                  )}
                  <small>
                    PDF, PNG, JPEG or WebP · 10 MB each. Context stays private
                    to you. Model interpretation requires Gemini setup; inferred
                    fields need your confirmation.
                  </small>
                </form>
              ) : (
                <div className="panel-body">
                  <Notice tone="green">
                    Brief confirmed. Use the supplier cards to collect actual
                    written offers.
                  </Notice>
                  <Link
                    className="btn btn-secondary"
                    href={`/requests/${demo.requestId}`}
                  >
                    Open full procurement request <ArrowRight size={16} />
                  </Link>
                </div>
              )}
            </section>
            {demo.confirmed && (
              <section className="panel">
                <div className="panel-head">
                  <div className="section-title">
                    <Users size={19} />
                    <h2>Your two supplier roles</h2>
                  </div>
                  <Badge>{quotes.length}/2 written offers</Badge>
                </div>
                <div className="panel-body demo-suppliers">
                  {suppliers.map((s) => {
                    const call = calls.find((c) => c.supplier_id === s.id);
                    return (
                      <article key={s.id} className="demo-supplier">
                        <div className="demo-supplier-top">
                          <span>{s.contact.slice(0, 1)}</span>
                          <div>
                            <h3>{s.contact}</h3>
                            <p>
                              {s.relationship === "Regular"
                                ? "Your usual supplier"
                                : "Nearby alternative · teammate role"}
                            </p>
                          </div>
                        </div>
                        <p>
                          <Phone size={14} /> {s.phone || "Phone number needed"}
                        </p>
                        <p className="muted">
                          Not a Google-discovered business. Share the private
                          portal so your teammate can submit their actual price,
                          tax and delivery terms.
                        </p>
                        <p>
                          <ShieldCheck size={14} /> Written sandbox contact:{" "}
                          {paymentContacts.find((p) => p.supplier_id === s.id)
                            ?.account || "Not provided"}{" "}
                          · unverified
                        </p>
                        <Button
                          variant="secondary"
                          disabled={!!busy}
                          onClick={() =>
                            void perform(s.id, async () => {
                              const link = await action(
                                "invitation.create",
                                demo.requestId,
                                { supplierId: s.id },
                              );
                              setLinks((l) => ({
                                ...l,
                                [s.id]: location.origin + link.url,
                              }));
                            })
                          }
                        >
                          Create private quote link
                        </Button>
                        {links[s.id] && (
                          <div className="demo-share">
                            <input
                              aria-label={`${s.contact} private quote link`}
                              readOnly
                              value={links[s.id]}
                            />
                            <a
                              href={links[s.id]}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open supplier portal ↗
                            </a>
                            <Button
                              variant="ghost"
                              onClick={() =>
                                void perform("copy", async () => {
                                  await navigator.clipboard.writeText(
                                    links[s.id],
                                  );
                                  toast(
                                    "Private link copied. Share it with this teammate only.",
                                  );
                                })
                              }
                            >
                              Copy link
                            </Button>
                          </div>
                        )}
                        {!call ? (
                          <>
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={!!consent[s.id]}
                                onChange={(e) =>
                                  setConsent((v) => ({
                                    ...v,
                                    [s.id]: e.target.checked,
                                  }))
                                }
                              />
                              <span>
                                This teammate agreed to a real AI test call.
                              </span>
                            </label>
                            <Button
                              variant="secondary"
                              disabled={!consent[s.id] || !!busy}
                              busy={busy === `call-${s.id}`}
                              onClick={() =>
                                void perform(`call-${s.id}`, async () => {
                                  await post("call", {
                                    supplierId: s.id,
                                    consent: true,
                                  });
                                  await refresh();
                                })
                              }
                            >
                              <Phone size={15} />
                              Call {s.contact} via Sarvam
                            </Button>
                          </>
                        ) : (
                          <>
                            <Badge tone="amber">{call.status}</Badge>
                            {call.provider_id && (
                              <small>
                                Provider attempt: {call.provider_id}
                              </small>
                            )}
                            {call.error && (
                              <p className="form-error">{call.error}</p>
                            )}
                            <Button
                              variant="secondary"
                              disabled={!!busy}
                              onClick={() =>
                                void perform("sync", async () => {
                                  await post("sync", { callId: call.id });
                                  await refresh();
                                })
                              }
                            >
                              Refresh provider status
                            </Button>
                            {call.transcript && (
                              <details>
                                <summary>Actual provider transcript</summary>
                                <pre className="demo-transcript">
                                  {call.transcript}
                                </pre>
                                <p>
                                  Review opt-outs and terms yourself. This
                                  transcript does not verify a quote or payment
                                  recipient.
                                </p>
                                <Button
                                  variant="ghost"
                                  onClick={() =>
                                    void action(
                                      "supplier.stopContact",
                                      undefined,
                                      { supplierId: s.id },
                                      "Future contact disabled.",
                                    )
                                  }
                                >
                                  Mark do not contact
                                </Button>
                              </details>
                            )}
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
                <div className="panel-body">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void perform("offers", async () => {
                        await refresh();
                        await load();
                      })
                    }
                  >
                    Refresh written offers
                  </Button>
                  <Link
                    className="btn btn-primary"
                    href={`/requests/${demo.requestId}?tab=quotes`}
                  >
                    Compare quotes & choose supplier <ArrowRight size={16} />
                  </Link>
                  {eligible[0] ? (
                    <Notice tone="green">
                      Lowest complete eligible offer: {eligible[0].company},{" "}
                      {money(eligible[0].total, eligible[0].currency)}. Review
                      terms before selecting; no order was automatically placed.
                    </Notice>
                  ) : (
                    <Notice>
                      No eligible offer yet. Complete written quotes must match
                      quantity, currency, deadline, requirements and budget.
                    </Notice>
                  )}
                </div>
              </section>
            )}
            {demo.confirmed && (
              <section className="panel">
                <div className="panel-head">
                  <div className="section-title">
                    <ShieldCheck size={19} />
                    <h2>Agreement, evidence & sandbox payment</h2>
                  </div>
                </div>
                <div className="panel-body">
                  <p>
                    Choose an offer, have the supplier accept it, then review
                    their delivery/invoice evidence. PayPal authorization
                    reserves sandbox funds; capture releases the agreed stage
                    amount to the configured merchant.
                  </p>
                  <Notice tone="amber">
                    Authorization is not escrow. A phone-provided email is
                    unverified. This app currently supports one configured
                    sandbox merchant; arbitrary supplier payouts and PayPal
                    Invoicing are not enabled.
                  </Notice>
                  <div className="demo-actions">
                    <Link
                      className="btn btn-primary"
                      href={`/requests/${demo.requestId}?tab=payments`}
                    >
                      Review payment setup <ArrowRight size={16} />
                    </Link>
                    {agreement && (
                      <a
                        className="btn btn-secondary"
                        href="/api/demo/order"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileText size={16} />
                        Download pro forma
                      </a>
                    )}
                    <Link className="btn btn-ghost" href="/settings">
                      Provider settings
                    </Link>
                  </div>
                </div>
              </section>
            )}
          </div>
          <aside className="demo-aside">
            {config && (
              <section className="panel demo-brief">
                <div className="panel-head">
                  <div className="section-title">
                    <FileText size={18} />
                    <h2>
                      {demo.confirmed
                        ? "Confirmed restock brief"
                        : "Your brief, as we learn"}
                    </h2>
                  </div>
                </div>
                <div className="panel-body">
                  <p>
                    Check extracted facts before confirming. Empty fields mean
                    we still need your answer.
                  </p>
                  <fieldset
                    disabled={demo.confirmed || !!busy}
                    className="demo-fields"
                  >
                    <Field label="Supermarket name">
                      <input
                        value={config.business}
                        onChange={(e) => update("business", e.target.value)}
                      />
                    </Field>
                    <Field label="Delivery address">
                      <textarea
                        rows={2}
                        value={config.address}
                        onChange={(e) => update("address", e.target.value)}
                        placeholder="Waiting for your store address"
                      />
                    </Field>
                    <Field
                      label="Drinks, brands & flavours"
                      hint="Shared with suppliers. Keep private budgets and negotiation notes out of this description."
                    >
                      <textarea
                        rows={2}
                        value={config.need}
                        onChange={(e) => update("need", e.target.value)}
                        placeholder="Waiting for your requirements"
                      />
                    </Field>
                    <div className="demo-field-pair">
                      <Field label="Number of cases">
                        <input
                          type="number"
                          min={1}
                          value={config.quantity || ""}
                          onChange={(e) =>
                            update("quantity", Number(e.target.value))
                          }
                        />
                      </Field>
                      <Field label="Currency">
                        <select
                          value={config.currency}
                          onChange={(e) =>
                            update(
                              "currency",
                              e.target.value as DemoConfig["currency"],
                            )
                          }
                        >
                          {["USD", "INR", "EUR", "GBP", "AUD", "CAD"].map(
                            (c) => (
                              <option key={c}>{c}</option>
                            ),
                          )}
                        </select>
                      </Field>
                    </div>
                    <Field label="Pack size">
                      <input
                        value={config.pack}
                        onChange={(e) => update("pack", e.target.value)}
                        placeholder="e.g. 24 × 250 ml cans per case"
                      />
                    </Field>
                    <div className="demo-field-pair">
                      <Field label="Total budget">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={config.budget ? config.budget / 100 : ""}
                          onChange={(e) =>
                            update(
                              "budget",
                              Math.round(Number(e.target.value) * 100),
                            )
                          }
                        />
                      </Field>
                      <Field label="Delivery date">
                        <input
                          type="date"
                          value={config.deadline}
                          onChange={(e) => update("deadline", e.target.value)}
                        />
                      </Field>
                    </div>
                    <Field label="Call language">
                      <select
                        value={config.language}
                        onChange={(e) =>
                          update(
                            "language",
                            e.target.value as DemoConfig["language"],
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
                    <Field
                      label="Prithish’s phone"
                      hint="Country code required, e.g. +91…"
                    >
                      <input
                        type="tel"
                        value={config.prithishPhone}
                        onChange={(e) =>
                          update("prithishPhone", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Karthick’s phone">
                      <input
                        type="tel"
                        value={config.karthickPhone}
                        onChange={(e) =>
                          update("karthickPhone", e.target.value)
                        }
                      />
                    </Field>
                  </fieldset>
                  {!demo.confirmed && (
                    <div className="demo-brief-buttons">
                      <Button
                        variant="secondary"
                        disabled={!!busy}
                        onClick={() =>
                          void perform("save", async () => {
                            adopt(await post("save", { config }));
                            await refresh();
                            toast("Draft saved.");
                          })
                        }
                      >
                        Save edits
                      </Button>
                      <Button
                        busy={busy === "confirm"}
                        disabled={!!busy}
                        onClick={() =>
                          void perform("confirm", async () => {
                            adopt(
                              await post("save", { config, confirm: true }),
                            );
                            await refresh();
                          })
                        }
                      >
                        Confirm restock brief <CheckCircle2 size={16} />
                      </Button>
                    </div>
                  )}
                </div>
              </section>
            )}
            <section className="panel">
              <div className="panel-head">
                <div className="section-title">
                  <MapPin size={18} />
                  <h2>Beyond the hackathon</h2>
                </div>
              </div>
              <div className="panel-body">
                <p>
                  In real use, find up to two beverage wholesalers around your
                  store through Google Places. Candidates need review; searching
                  never places calls.
                </p>
                <Button
                  variant="secondary"
                  disabled={!config?.address || !!busy}
                  busy={busy === "places"}
                  onClick={() =>
                    void perform("places", async () => {
                      const result = await post("places", {
                        address: config?.address,
                      });
                      setPlaces(result.places);
                    })
                  }
                >
                  Find nearby suppliers
                </Button>
                <small>
                  Requires connected owner and GOOGLE_PLACES_API_KEY.
                </small>
                {places && (
                  <div className="demo-places">
                    <a
                      href="https://maps.google.com"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Google Maps
                    </a>
                    {!places.length && (
                      <p>No results returned for this location.</p>
                    )}
                    {places.map((p) => (
                      <article key={p.id}>
                        <h3>{p.displayName.text}</h3>
                        <p>{p.formattedAddress}</p>
                        <p>
                          {p.internationalPhoneNumber || "No phone returned"}
                        </p>
                        {p.googleMapsUri && (
                          <a
                            href={p.googleMapsUri}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View on Google Maps ↗
                          </a>
                        )}
                        {p.attributions?.map((a, i) => (
                          <small key={i}>{a.provider}</small>
                        ))}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
            <div className="demo-honesty">
              <MessageSquare size={18} />
              <p>
                Chat helps prepare decisions. Only provider responses and
                written supplier offers can establish what actually happened.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
