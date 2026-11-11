# ProcureProof

The interface uses a shared navy-and-blue payment theme across buyer pages, request chat/forms, supplier portal, evidence review and settings. PayPal approval links open a branded handoff with a cancel option and HTTPS sandbox-destination validation. This screen does not mark payments successful. `npm run preview:theme` captures desktop/tablet/mobile views from an isolated test business workspace.

**Current request interface:** Requests → New request now opens an OpenAI purchasing chat with the complete editable brief beside it. All businesses and the supermarket scenario use this same journey; the separate supermarket navigation is removed. Configure `OPENAI_API_KEY`, `OPENAI_INTAKE_MODEL` and, for a private local instance, `LOCAL_AI_ENABLED=true`. See [Request assistant setup](docs/REQUEST_ASSISTANT.md). Earlier supermarket-demo notes below describe legacy compatibility paths.

**From supplier conversation to verified payment.**

A responsive procurement workspace for custom packaging, labels and merchandise. The main journey connects versioned requirements, regular suppliers, written quotations, a two-party agreement, fresh document checks, owner acceptance and a separately confirmed PayPal payment.

The repository was empty at the start. This implementation uses Next.js App Router, TypeScript, React, locally served Inter, Lucide, real AG Grid Community, Auth.js, SQLite, PDF.js through `unpdf`, `pdf-lib` and a durable job worker. No external account or license was supplied. See [FEATURE_STATUS.md](FEATURE_STATUS.md) for the exact boundary between tested local features, provider adapters and blocked/deferred work.

## Run locally

Requires Node **20.20+ or 22.22+**, npm and a writable disk. Native dependencies provide Linux/macOS/Windows prebuilds for supported architectures; unsupported platforms need a C++ build toolchain.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open **http://localhost:3000**. First use asks for your business name and creates an empty private business workspace. Your business name and initials appear throughout the dashboard, and you can edit the business profile in Settings. The fictional Juniper coffee-shop walkthrough is optional and opens only when explicitly selected. Existing demo sessions also see this choice on first use after the update. No credentials are required for local records or the optional sample walkthrough. `npm run dev` starts Next.js and a separate worker; both stop together. The worker watches source changes during development. Keep `APP_URL` aligned with the browser URL, including the port.

The supermarket scenario uses the same Requests assistant and supplier journey as any other business. Prithish and Karthick are buyer-entered contacts; no special supplier names, quantities or successful provider results are preloaded. OpenAI setup requirements remain visible. Older supermarket records are preserved for compatibility.

Migrations run automatically and are also available through `npm run db:migrate`. Local business sessions receive separate, signed, HTTP-only workspace cookies and start without requests, suppliers or quotes. Sample sessions remain separate; Settings lets you return to your business without copying demo records. `npm run seed` prepares a separate CLI workspace; it does not expose shared private buyer records. Samples use future dates calculated when seeded, `.example` emails and no executable supplier phone numbers.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

For production mode, set a stable random `SESSION_SECRET` before `npm start`. Use separate random `AUTH_SECRET` and `SESSION_SECRET` values of at least 32 characters. Development creates a private local signing key in the ignored data directory. Production never creates an implicit signing secret.

### Browser verification

Start the application, then:

```sh
CHROME_PATH=/path/to/chrome npm run test:e2e
```

The default installed-browser path is `/opt/google/chrome/chrome`. Alternatively install Playwright Chromium and set its executable path. The suite exercises the app at 1440, 1024 and 390 pixels, the evidence correction journey, fresh request/file creation, saved suppliers, quotation revisions, scoped invitations, workspace separation and rejection of unsigned webhooks. The original labelled reference, correct, wrong-phone and missing-wording PDFs/PNGs are included in `public/examples/`; regenerate them with `npm run examples`.

Screenshots and traces go to ignored `test-results/`; the HTML report is in `playwright-report/`. `node scripts/inspect.mjs` performs additional visual capture against localhost:3000.

The domain tests use an isolated temporary SQLite database and an **explicit mock PayPal transport**. Their provider IDs never enter the browser workspace. These tests verify application policy; they are not real PayPal sandbox transactions.

## Walk through the application

1. Open **Branded takeaway boxes → Quotes**. Evergreen has a complete, timely written offer. Paper & Form is late; Northline has unknown tax. No hidden costs are silently treated as zero.
2. Open **Files & review**, run document checks and inspect the incorrect printed number. Failed checks block acceptance.
3. Record a correction, load the correct example or upload a fresh PDF, and rerun checks. The new submission invalidates earlier acceptance. Review the actual document and all unknown/visual findings, then accept the stage.
4. Open **Payments**. In the sample workspace there is no authorization, capture or invented provider reference. Connect sandbox to exercise real provider operations.
5. Create a fresh request or save a regular supplier. Create a quote link from **Suppliers & calls**. Open that private portal in another browser to submit or revise a written offer.

See [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for a short presentation sequence. Captured sample-only screenshots are in [docs/screenshots](docs/screenshots).

## Connect an owner workspace

Create a GitHub OAuth application. Set `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_SECRET` and comma-separated `AUTH_OWNER_GITHUB_LOGINS`. Register `/api/auth/callback/github` on the same origin as `APP_URL`.

Set `AUTH_URL` to the same browser-facing origin as `APP_URL` (locally, `http://localhost:3000`). The GitHub OAuth application's Authorization callback URL must be `http://localhost:3000/api/auth/callback/github` for that local setup. A `0.0.0.0` callback is a server listening address and must not be used. Restart after environment changes; when using a public tunnel, update both origins and GitHub's callback registration together. The app falls back to `APP_URL` when `AUTH_URL` is unset.

In **Settings & integrations**, use **Owner sign-in**, then explicitly open **Connected sandbox**. Your business workspace is connected without replacing its name or records. Only allowlisted GitHub owners can access that workspace. A sample session cannot call the payment API. Supplier invitations are a separate capability with no owner session or competing-offer access.

Each configured owner has a separate connected workspace, bound server-side to their authenticated identity. Connecting a local business workspace preserves its records. Multi-organization membership administration is deferred. Changing an allowed owner requires restarting the server; revoke existing Auth.js sessions when removing an owner.

## PayPal sandbox setup

Use a dedicated **supplier business sandbox account**, its REST application and a **separate buyer personal sandbox account**. Set:

| Variable                                   | Purpose                                                     |
| ------------------------------------------ | ----------------------------------------------------------- |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | OAuth credentials for the dedicated supplier business app   |
| `PAYPAL_MERCHANT_ID`                       | The same supplier business merchant ID                      |
| `PAYPAL_WEBHOOK_ID`                        | Registered webhook ID for that app                          |
| `APP_URL`                                  | The actual application origin for redirects and CSRF checks |

Register an HTTPS listener at `/api/webhooks/paypal`. Include `CHECKOUT.ORDER.APPROVED`, authorization created/voided and capture completed/pending/denied/refunded events. Real PayPal events are authenticated through the documented verify-signature REST endpoint. Simulator messages cannot be verified through that postback mechanism and are intentionally rejected. Verified events are deduplicated and schedule durable canonical-state reconciliation; event ordering itself does not determine payment status.

Run **PayPal preflight** in Settings. OAuth success is reported as OAuth verification, not proof of merchant payment capability. No credentials were present during implementation, so this check reported the missing environment variables rather than fabricating a connection.

In connected sandbox:

1. Save the fictional test supplier represented by that merchant. Explicitly map it to the dedicated merchant in Settings.
2. Create and confirm a request. Submit a written quote through its private invitation, select it as buyer and accept the resulting agreement as supplier in the portal.
3. In Payments, review the recipient, exact amount, currency and stage, then create an `AUTHORIZE` order.
4. Complete actual buyer approval on PayPal. On return, choose **Verify buyer approval & authorize**. The server retrieves the order before authorization; the redirect is not proof.
5. Submit evidence, run checks and accept the current stage. Review and confirm capture separately. Only a completed provider response or canonical reconciliation produces **Captured**.
6. An unused authorization can be voided; a captured payment can be fully or partially refunded against the original capture. Pending is distinct from completed. Remaining balance and concurrent operations are checked on the server.

This is a **single configured sandbox merchant demonstration**, not production supplier onboarding or a shared platform wallet. No Payouts, escrow claims, arbitrary merchant capture, partial captures or multi-capture assumptions are included. Capture is conservatively blocked after the initial three-day honor period; void and obtain fresh approval through a replacement request. The 29-day expiry is displayed and never treated as indefinite holding.

Operation IDs and stable PayPal request IDs are persisted before mutation. A unique database constraint permits only one unresolved financial operation per payment. After a timeout, new financial operations are blocked until provider state is retrieved. If order creation or refund timed out before returning any provider ID, the app deliberately leaves it unresolved: inspect the saved request ID and the PayPal dashboard/support record, then reconcile through an operator procedure. There is no blind retry or generic “mark paid” endpoint. A full operator recovery UI for that edge case remains deferred.

Official interfaces consulted: [Orders/authorize/capture](https://developer.paypal.com/checkout/delay-capture/), [authorization and honor period](https://developer.paypal.com/payment-methods/auth-honor/), [webhook authentication](https://developer.paypal.com/api/rest/webhooks/rest/). No PayPal MCP/context plugin was available in this session; the implementation uses the documented server-side REST API.

## Supplier discovery and conversations

Set `TAVILY_API_KEY`, confirm a request with discovery enabled, a region and a limit of 1–10 new candidates, then start search in **Suppliers & calls**. A durable job calls the [actual Tavily Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search). Results retain the source URL, retrieved time and source excerpt. Duplicate URLs and regular supplier domains are excluded. Results are public candidates, not verified suppliers. Contact details and delivery coverage need owner review. Search does not share private artwork or launch outreach. No external discovery could be exercised without the key.

**Sarvam test calls require account setup.** The supermarket demo has an adapter for the official [outbound API](https://docs.sarvam.ai/voice-agents/api/instant-outbound/create) and [authenticated Analytics refresh](https://docs.sarvam.ai/voice-agents/api/analytics/overview). Credentials, committed verified agent/version and supported allowlisted destinations are still required; no actual call was made. General automated outreach remains blocked. Unsigned callbacks are rejected. See [docs/SARVAM_SETUP.md](docs/SARVAM_SETUP.md).

Invitations and follow-up questions are stored locally. The app does not send email; share links and correction notes through an agreed channel. A supplier can be marked **Do not contact** in its directory record.

## Evidence, data and security decisions

- Requirements freeze a numbered version and the approved reference asset IDs. Revisions invalidate agreement approval. Written supplier quotation versions are append-only and totals use integer minor units, including an explicit null for unknown shipping or tax.
- Selection freezes the supplier, quote, exact amount/currency, stage and reference files. A selected supplier must explicitly agree through its invitation before submitting stage evidence.
- Fresh PDF text extraction checks exact wording, documented dimensions and labelled quantity. Physical evidence checks remain Unknown. Separately, supermarket chat supports optional Gemini PDF/image intake; inferred draft fields cannot approve evidence or payments. A multimodal evidence-review adapter remains unimplemented.
- Original PDFs use embedded open-source fonts; previews render from the actual PDF bytes. Uploaded images display their real content. Pan/zoom and original-file access are available. No fabricated boxes or confidence percentages are shown.
- Analysis findings are distinct from authoritative agreements and payment records. Supplier text is data, never system instructions or financial authority. Human acceptance is required, including explicit review of unknown findings. Failed checks cannot be accepted.
- Files allow PDF, PNG, JPEG and WebP with MIME, extension, signature and 10 MB limits. SVG/executable uploads are rejected. PDFs are not executed; parsing disables evaluation, caps image size and limits analysis to 30 pages. This is not a malware-scanning service; hostile-file resource isolation and antivirus scanning remain production-hardening work.
- Assets are private SQLite BLOBs. Owner file requests enforce workspace ownership; supplier file requests require an unexpired invitation scoped to that request and approved references/that supplier’s own uploads. Tokens are stored only as SHA-256 hashes, expire after seven days and are not persisted as plaintext invitation links. Provider logs omit credentials.
- Every API mutation checks same-origin requests. Session cookies are signed, HTTP-only and SameSite=Lax. Auth.js handles connected owner OAuth. Audit events are append-only with database triggers.
- SQLite WAL, foreign keys, transactions, unique financial locks and migration history provide durable **single-instance** operation. The separate worker leases persistent jobs and recovers abandoned analysis/search/reconciliation jobs. SQLite was chosen for a zero-credential local run; PostgreSQL/Prisma and S3 are not configured in this release. Move to PostgreSQL/object storage before horizontal scaling.
- Local search filters only records already returned by the workspace-scoped API. Elastic and AI retrieval are deferred. AG Grid Community is real and MIT-licensed; AG Studio, enterprise widgets and agent APIs are explicitly not claimed.

## Render deployment preparation

`render.yaml` defines one Node web service, an HTTPS health endpoint, generated signing secrets and a **persistent disk** mounted at `/var/data`. `npm start` supervises Next.js and the durable worker on that same instance. No deployment has been performed. Review the paid disk/service requirements before provisioning; this task did not purchase or provision hosting.

Set `APP_URL` to the final Render origin and supply owner/provider variables in the Render dashboard. Leave credentials empty to retain the local/sample experience and visible setup requirements. Preserve and back up the disk, including SQLite/WAL files, using a consistent SQLite backup. Do not run multiple instances or a separate diskless worker against the local file path. No public file directory contains buyer artwork.

## Repository map

| Location                               | Responsibility                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| `src/components/`                      | Shell, overview, request wizard, comparison, review, portal and payment UI   |
| `src/lib/domain.ts`                    | Versioned requirements, scoped invitations, agreements and acceptance policy |
| `src/lib/providers/paypal.ts`          | Documented sandbox REST adapter, operation locks, refunds and reconciliation |
| `src/lib/providers/search.ts`          | Bounded Tavily discovery and source retention                                |
| `src/lib/review.ts`, `pdf.ts`          | Fresh PDF checks and previews                                                |
| `src/lib/session.ts`, `src/auth.ts`    | Isolated sample capabilities and Auth.js owner sign-in                       |
| `migrations/`                          | Durable schema and constraints                                               |
| `scripts/worker.ts`, `src/lib/jobs.ts` | Persistent background work                                                   |
| `tests/`                               | Domain/payment-policy tests and real-browser journeys                        |

Application source is MIT-licensed. Bundled Liberation fonts retain their SIL Open Font License; see `assets/fonts/LICENSE.txt`.
