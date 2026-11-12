"use client";
import { useState } from "react";
import {
  ArrowRight,
  Building2,
  ShieldCheck,
  FileText,
  Users,
  CreditCard,
  Check,
} from "lucide-react";
import { Button, Field, Logo } from "./ui";
export function BusinessSetup({
  onOpen,
  embedded = false,
}: {
  onOpen: (
    mode: "local" | "sample",
    business?: { name: string; timezone: string },
  ) => Promise<void>;
  embedded?: boolean;
}) {
  const [name, setName] = useState(""),
    [timezone, setTimezone] = useState("Asia/Kolkata"),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function open(mode: "local" | "sample") {
    setBusy(mode);
    setError("");
    try {
      await onOpen(mode, { name: name.trim(), timezone });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section
      className={embedded ? "business-setup-embedded" : "business-setup"}
    >
      {!embedded && (
        <div className="setup-brand">
          <Logo />
        </div>
      )}
      {!embedded && (
        <div className="setup-story">
          <span className="setup-kicker">YOUR NEXT ORDER STARTS HERE</span>
          <h2>
            Better purchasing.
            <br />
            <span>
              From the first brief
              <br />
              to the final payment.
            </span>
          </h2>
          <p>
            Bring your requirements, supplier conversations and approvals into
            one clear workspace.
          </p>
          <div className="setup-journey" aria-label="Purchasing journey">
            {[
              {
                icon: FileText,
                title: "Describe what you need",
                text: "Build a purchase brief with your assistant.",
              },
              {
                icon: Users,
                title: "Compare supplier offers",
                text: "Keep written quotes and agreements together.",
              },
              {
                icon: ShieldCheck,
                title: "Review before you pay",
                text: "Check supplier evidence and approve each step.",
              },
            ].map((step, i) => (
              <div className="setup-journey-step" key={step.title}>
                <span className="setup-step-icon">
                  <step.icon size={23} />
                </span>
                <div>
                  <small>0{i + 1}</small>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="setup-story-footer">
            <CreditCard size={18} />
            <span>
              PayPal Sandbox payments <span aria-hidden="true">·</span>{" "}
              Buyer-controlled approvals
            </span>
          </div>
        </div>
      )}
      <div className="business-setup-card">
        <span className="setup-business-icon">
          <Building2 size={27} />
        </span>
        <div className="eyebrow">SET UP YOUR WORKSPACE</div>
        <h1>
          Your business.
          <br />
          Your purchasing workspace.
        </h1>
        <p>
          Create a workspace with your own business name, requests and
          suppliers. Start with a clean dashboard.
        </p>
        {!embedded && (
          <div className="setup-benefits">
            <span>
              <Check size={14} />
              Your suppliers
            </span>
            <span>
              <Check size={14} />
              Your requirements
            </span>
            <span>
              <Check size={14} />
              Your approvals
            </span>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void open("local");
          }}
        >
          <Field label="Business name" required>
            <input
              autoFocus
              required
              minLength={2}
              maxLength={100}
              placeholder="e.g. Acme Design Studio"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Business time zone">
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
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
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <Button
            className="full-width"
            type="submit"
            busy={busy === "local"}
            disabled={!!busy || name.trim().length < 2}
          >
            Create my business workspace
            <ArrowRight size={16} />
          </Button>
        </form>
        <div className="setup-privacy">
          <ShieldCheck size={16} />
          <span>
            Your records are stored privately for this browser. Owner sign-in
            and provider setup are required for connected payments.
          </span>
        </div>
        {!embedded && (
          <div className="setup-sample">
            <span>Want to explore first?</span>
            <Button
              variant="ghost"
              disabled={!!busy}
              busy={busy === "sample"}
              onClick={() => void open("sample")}
            >
              Open sample walkthrough
              <ArrowRight size={14} />
            </Button>
            <small>
              Optional fictional coffee-shop example. Kept separate from your
              business.
            </small>
          </div>
        )}
      </div>
    </section>
  );
}
