import { all, one } from "../db";
import { authConfigured } from "../session";
import { publicAppOrigin } from "./email";
export type Integration = {
  id: string;
  name: string;
  category: string;
  status: string;
  detail: string;
  variables: string[];
  docs: string;
  checkedAt?: string;
};
export function integrationHealth(): Integration[] {
  const preflights = all<{
    provider: string;
    status: string;
    detail: string;
    checked_at: string;
  }>("SELECT * FROM preflight");
  const paypal = [
    "PAYPAL_CLIENT_ID",
    "PAYPAL_CLIENT_SECRET",
    "PAYPAL_MERCHANT_ID",
    "PAYPAL_WEBHOOK_ID",
  ];
  const voice = [
    "SARVAM_API_KEY",
    "SARVAM_ORG_ID",
    "SARVAM_WORKSPACE_ID",
    "SARVAM_APP_ID",
    "SARVAM_CONNECTION_ID",
    "SARVAM_AGENT_PHONE",
    "SARVAM_ALLOWED_NUMBERS",
    "SARVAM_APP_VERSION",
    "SARVAM_DEMO_AGENT_VERIFIED",
  ];
  const health = (keys: string[]) => keys.every((k) => !!process.env[k]);
  const paypalCheck = preflights.find((p) => p.provider === "paypal");
  return [
    {
      id: "hosting",
      name: "Public supplier portal",
      category: "Render hosting",
      status: publicAppOrigin()
        ? "Public URL configured · unverified"
        : "Deployment required",
      detail:
        "Deploy the Render Blueprint with its persistent disk, then set APP_URL to the live HTTPS origin. A configured URL alone does not verify reachability or migrate local records.",
      variables: publicAppOrigin() ? [] : ["APP_URL"],
      docs: "https://render.com/docs/infrastructure-as-code",
    },
    {
      id: "email",
      name: "Supplier invitation email",
      category: "Resend delivery",
      status:
        health(["RESEND_API_KEY", "EMAIL_FROM"]) && publicAppOrigin()
          ? "Configured · unverified"
          : "Setup required",
      detail:
        "Create a private quotation link, review its recipient, then choose Email invitation. Requires a verified sender domain. Provider acceptance is recorded separately from inbox delivery.",
      variables: [
        "RESEND_API_KEY",
        "EMAIL_FROM",
        ...(!publicAppOrigin() ? ["APP_URL"] : []),
      ].filter((k) => k === "APP_URL" || !process.env[k]),
      docs: "https://resend.com/docs/dashboard/domains/introduction",
    },
    {
      id: "intake",
      name: "OpenAI request assistant",
      category: "Buyer chat & document understanding",
      status:
        process.env.OPENAI_API_KEY && process.env.OPENAI_INTAKE_MODEL
          ? "Configured · unverified"
          : "Setup required",
      detail:
        "The Requests assistant uses OpenAI to extract a reviewable brief and ask for missing details. Buyer-approved context files stay private to intake. The model cannot launch calls, confirm requests or move funds. Manual forms remain available without a key.",
      variables: ["OPENAI_API_KEY", "OPENAI_INTAKE_MODEL"].filter(
        (k) => !process.env[k],
      ),
      docs: "https://developers.openai.com/api/docs/guides/structured-outputs",
    },
    {
      id: "places",
      name: "Google Places",
      category: "Nearby beverage suppliers",
      status: process.env.GOOGLE_PLACES_API_KEY
        ? "Configured · unverified"
        : "Setup required",
      detail:
        "Text Search (New) returns up to two location-based beverage wholesaler candidates in the supermarket demo. Results are temporary, need review and are never automatically called.",
      variables: process.env.GOOGLE_PLACES_API_KEY
        ? []
        : ["GOOGLE_PLACES_API_KEY"],
      docs: "https://developers.google.com/maps/documentation/places/web-service/text-search",
    },
    {
      id: "paypal",
      name: "PayPal",
      category: "Sandbox payments",
      status:
        paypalCheck?.status ||
        (health(paypal) ? "Ready to test" : "Setup required"),
      detail:
        paypalCheck?.detail ||
        "Connect a dedicated sandbox supplier merchant and a separate buyer test account. No payments have been simulated.",
      variables: paypal.filter((k) => !process.env[k]),
      docs: "https://developer.paypal.com/checkout/delay-capture/",
      checkedAt: paypalCheck?.checked_at,
    },
    {
      id: "sarvam",
      name: "Sarvam",
      category: "Supplier conversations",
      status: health(voice)
        ? "Account verification required"
        : "Setup required",
      detail:
        "Supermarket demo has an explicit-consent, allowlisted outbound adapter with authenticated Analytics refresh. A committed verified procurement agent/version and supported test destination are required. General automated outreach remains blocked; unverified callbacks cannot change records.",
      variables: voice.filter((k) => !process.env[k]),
      docs: "https://docs.sarvam.ai/voice-agents/api/instant-outbound/create",
    },
    {
      id: "search",
      name: "Tavily",
      category: "Supplier discovery",
      status: process.env.TAVILY_API_KEY
        ? "Configured · unverified"
        : "Setup required",
      detail:
        "Bounded public web search with source URLs. You review candidates before any outreach.",
      variables: process.env.TAVILY_API_KEY ? [] : ["TAVILY_API_KEY"],
      docs: "https://docs.tavily.com/documentation/api-reference/endpoint/search",
    },
    {
      id: "analysis",
      name: "Document checks",
      category: "Evidence review",
      status: "Local checks available",
      detail:
        "Deterministic text extraction from fresh PDFs. Images, logos and physical quality require owner review. A multimodal provider is not connected.",
      variables: ["Multimodal document provider (not implemented)"],
      docs: "https://github.com/unjs/unpdf",
    },
    {
      id: "agstudio",
      name: "AG Grid Community",
      category: "Quote comparison",
      status: "Connected locally",
      detail:
        "Real AG Grid Community with filtering and evidence details. AG Studio commercial analytics and agent APIs require a license and separate integration.",
      variables: ["AG Studio license and integration (blocked)"],
      docs: "https://www.ag-grid.com/react-data-grid/getting-started/",
    },
    {
      id: "retrieval",
      name: "Workspace search",
      category: "Document retrieval",
      status: "Local records",
      detail:
        "Search is scoped to the current workspace. Elastic indexing and provider-backed retrieval are deferred.",
      variables: ["ELASTIC_URL", "ELASTIC_API_KEY"],
      docs: "https://www.elastic.co/docs",
    },
    {
      id: "auth",
      name: "Owner sign-in",
      category: "Connected sandbox access",
      status: authConfigured() ? "Configured · unverified" : "Setup required",
      detail:
        "Auth.js with GitHub OAuth and an owner login allowlist. Sample sessions are isolated and cannot access payment APIs.",
      variables: [
        "AUTH_SECRET",
        "AUTH_GITHUB_ID",
        "AUTH_GITHUB_SECRET",
        "AUTH_OWNER_GITHUB_LOGINS",
      ].filter((k) => !process.env[k]),
      docs: "https://authjs.dev/getting-started/providers/github",
    },
    {
      id: "storage",
      name: "Private file storage",
      category: "Requests & artwork",
      status: "Local persistent storage",
      detail:
        "Private SQLite asset storage; files are never public. Render requires the provided persistent disk. Single-instance deployment.",
      variables: [],
      docs: "https://render.com/docs/disks",
    },
  ];
}
export function sandboxMerchant() {
  return process.env.PAYPAL_MERCHANT_ID || "";
}
export function providerConfigured(name: string) {
  return !!one(
    "SELECT provider FROM preflight WHERE provider=? AND status=?",
    name,
    "Connected",
  );
}
