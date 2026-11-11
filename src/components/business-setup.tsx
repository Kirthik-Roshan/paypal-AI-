"use client";
import { useState } from "react";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
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
      <div className="business-setup-card">
        <span className="setup-business-icon">
          <Building2 size={27} />
        </span>
        <div className="eyebrow">PROCUREMENT FOR YOUR BUSINESS</div>
        <h1>
          Your business.
          <br />
          Your purchasing workspace.
        </h1>
        <p>
          Create a workspace with your own business name, requests and
          suppliers. Start with a clean dashboard.
        </p>
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
