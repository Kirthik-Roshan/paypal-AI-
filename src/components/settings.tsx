"use client";
import { date } from "@/lib/format";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Database,
  FileSearch,
  HardDrive,
  LockKeyhole,
  Mail,
  Globe,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Table2,
} from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BusinessSetup } from "./business-setup";
import { jsonFetch, useWorkspace } from "./context";
import { Badge, Button, Notice, Status, Field, Modal } from "./ui";
const icons: Record<string, typeof CreditCard> = {
  hosting: Globe,
  email: Mail,
  paypal: CreditCard,
  sarvam: Phone,
  search: Search,
  analysis: FileSearch,
  agstudio: Table2,
  retrieval: Database,
  auth: LockKeyhole,
  storage: HardDrive,
};
export function SettingsPage() {
  const { data, action, toast, refresh } = useWorkspace();
  const router = useRouter();
  const [creating, setCreating] = useState(false),
    [businessName, setBusinessName] = useState(data.workspace.name),
    [businessTimezone, setBusinessTimezone] = useState(data.workspace.timezone);
  const [busy, setBusy] = useState(""),
    [map, setMap] = useState("");
  async function switchMode(mode: string) {
    setBusy(mode);
    try {
      await jsonFetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      await refresh();
      localStorage.setItem(
        "pp-demo-opt-in",
        mode === "sample" ? "true" : "false",
      );
      router.push("/");
      toast(
        mode === "sample"
          ? "Sample workspace opened."
          : "Connected sandbox opened.",
      );
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE, CONNECTED</div>
          <h1>
            Settings & integrations<span className="heading-dot">.</span>
          </h1>
          <p>A clear picture of what’s connected and what still needs setup.</p>
        </div>
      </div>
      {data.workspace.mode !== "sample" && (
        <section className="panel business-profile">
          <div className="panel-head">
            <h2>Your business</h2>
            <Badge>
              {data.workspace.mode === "local"
                ? "Private business workspace"
                : "Connected business workspace"}
            </Badge>
          </div>
          <form
            className="panel-body"
            onSubmit={(e) => {
              e.preventDefault();
              setBusy("profile");
              void action(
                "workspace.update",
                undefined,
                { name: businessName, timezone: businessTimezone },
                "Business details saved.",
              )
                .catch(() => {})
                .finally(() => setBusy(""));
            }}
          >
            <div className="form-grid">
              <Field label="Business name" required>
                <input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  minLength={2}
                  maxLength={100}
                  required
                />
              </Field>
              <Field label="Business time zone">
                <select
                  value={businessTimezone}
                  onChange={(e) => setBusinessTimezone(e.target.value)}
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
            <Button type="submit" busy={busy === "profile"}>
              Save business details
            </Button>
          </form>
        </section>
      )}
      <section className="panel mode-panel">
        <div>
          <span className="section-kicker">WORKSPACE MODE</span>
          <h2>
            {data.workspace.mode === "sample"
              ? "A safe place to walk through an order."
              : data.workspace.mode === "local"
                ? "Your business, ready for its first order."
                : "Your connected sandbox workspace."}
          </h2>
          <p>
            {data.workspace.mode === "sample"
              ? "Fictional businesses. Real local documents and decisions. No outbound calls or payments."
              : data.workspace.mode === "local"
                ? "Your own requests, files and supplier directory. Connect owner sign-in and providers when you are ready to use sandbox payments."
                : "Owner-authenticated workspace. Provider operations use configured accounts and real sandbox states."}
          </p>
        </div>
        <div className="mode-options">
          {data.workspace.mode === "sample" && (
            <>
              <Button onClick={() => setCreating(true)}>
                Create my business workspace
              </Button>
              <Button
                variant="secondary"
                onClick={() => void switchMode("local")}
              >
                Return to my business
              </Button>
            </>
          )}
          <button
            className={data.workspace.mode === "sample" ? "active" : ""}
            onClick={() => void switchMode("sample")}
            disabled={!!busy}
          >
            <span className="mode-option-icon">
              <ShieldCheck size={21} />
            </span>
            <span>
              <strong>Sample walkthrough</strong>
              <small>Explore with fictional records</small>
            </span>
            {data.workspace.mode === "sample" && <CheckCircle2 size={18} />}
          </button>
          <button
            className={data.workspace.mode === "sandbox" ? "active" : ""}
            onClick={() => void switchMode("sandbox")}
            disabled={!!busy}
          >
            <span className="mode-option-icon">
              <CreditCard size={21} />
            </span>
            <span>
              <strong>Connected sandbox</strong>
              <small>Sign-in and provider setup required</small>
            </span>
            {data.workspace.mode === "sandbox" ? (
              <CheckCircle2 size={18} />
            ) : (
              <ChevronRight size={18} />
            )}
          </button>
        </div>
      </section>
      {creating && (
        <Modal title="Set up your business" onClose={() => setCreating(false)}>
          <BusinessSetup
            embedded
            onOpen={async (mode, business) => {
              await jsonFetch("/api/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode, ...business }),
              });
              localStorage.setItem("pp-demo-opt-in", "false");
              await refresh();
              setCreating(false);
              router.push("/");
            }}
          />
        </Modal>
      )}
      <div className="settings-heading">
        <h2>Provider connections</h2>
        <span>Credentials stay on your server.</span>
      </div>
      <div className="integration-grid">
        {data.integrations.map((p) => {
          const Icon = icons[p.id] || Database;
          return (
            <section className="panel integration-card" key={p.id}>
              <div className="integration-top">
                <span className={`integration-icon integration-${p.id}`}>
                  <Icon size={23} strokeWidth={1.7} />
                </span>
                <div>
                  <h3>{p.name}</h3>
                  <span>{p.category}</span>
                </div>
                <Status value={p.status} />
              </div>
              <p>{p.detail}</p>
              {p.variables.length > 0 && (
                <details className="setup-details">
                  <summary>
                    Setup requirements <span>{p.variables.length}</span>
                  </summary>
                  <div>
                    {p.variables.map((v) => (
                      <code key={v}>{v}</code>
                    ))}
                    <p>
                      Add server variables to <code>.env.local</code> and
                      restart the app. See README for account-specific steps.
                    </p>
                  </div>
                </details>
              )}
              <div className="integration-foot">
                <a
                  href={p.docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link subtle-link"
                >
                  Official documentation
                  <ArrowUpRight size={14} />
                </a>
                {p.id === "paypal" && (
                  <Button
                    variant="secondary"
                    busy={busy === "paypal"}
                    onClick={() => {
                      setBusy("paypal");
                      void action(
                        "payment.preflight",
                        undefined,
                        undefined,
                        "PayPal preflight completed.",
                      )
                        .catch(() => {})
                        .finally(() => setBusy(""));
                    }}
                  >
                    <RefreshCw size={14} />
                    Run preflight
                  </Button>
                )}
                {p.id === "auth" && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void signIn("github", { redirectTo: "/settings" })
                    }
                  >
                    Owner sign-in
                    <ArrowUpRight size={14} />
                  </Button>
                )}
              </div>
              {p.checkedAt && (
                <small className="checked-at">
                  Last checked{" "}
                  {date(p.checkedAt, { hour: "2-digit", minute: "2-digit" })}
                </small>
              )}
            </section>
          );
        })}
      </div>
      <section className="panel merchant-mapping">
        <div className="panel-head">
          <div>
            <h2>Sandbox merchant mapping</h2>
            <p className="muted">
              A limited demonstration with one dedicated supplier merchant and a
              separate buyer test account.
            </p>
          </div>
          <Badge tone="blue">Test accounts only</Badge>
        </div>
        <div className="merchant-map-body">
          <Notice tone="neutral">
            A buyer account cannot capture payments on behalf of arbitrary
            suppliers. Map only the fictional test supplier represented by the
            configured sandbox merchant.
          </Notice>
          <div className="inline-form">
            <select
              aria-label="Supplier to map to sandbox merchant"
              value={map}
              onChange={(e) => setMap(e.target.value)}
            >
              <option value="">Select your sandbox test supplier</option>
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.company}
                  {s.merchant_id ? " · mapped" : ""}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              disabled={!map || data.workspace.mode !== "sandbox"}
              onClick={() =>
                void action(
                  "supplier.mapMerchant",
                  undefined,
                  { supplierId: map },
                  "Sandbox merchant mapped.",
                ).catch(() => {})
              }
            >
              Confirm merchant mapping
            </Button>
          </div>
          {data.workspace.mode === "sample" && (
            <p className="field-hint">
              Available after owner sign-in in connected sandbox.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
