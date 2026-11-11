# Feature status

## Current checkpoint — 11 November 2026

This checkpoint supersedes older statements below that credentials were never supplied or that no real call occurred. Sarvam work is on hold at the owner's request.

- General Requests chat/form, supplier quotation links, quotation comparison, agreement acceptance, private evidence checks and explicit payment actions are implemented. Earlier automated checks are listed below; they have not all been rerun at this checkpoint.
- The connected workspace database contains a PayPal payment recorded as Captured, with order, authorization and capture references; another order is Awaiting buyer approval. This is persisted application evidence, not a fresh PayPal API reconciliation or proof of production payment.
- Actual Sarvam calls and authenticated Analytics retrieval were exercised. Sarvam retained the correct workspace cola brief but spoke about another business/product. Dynamic agent behavior remains unresolved. Call records now expose sent-context snapshots for new attempts and provider final-variable diagnostics on refresh.
- OpenAI and PayPal settings are present. Presence alone does not verify account capabilities. Tavily, Google Places and Elastic credentials are absent in the current local configuration.
- AG Grid Community comparison is implemented. AG Studio, Elastic ingestion/retrieval, Bryntum timeline and APIMatic integration remain incomplete. Render configuration exists; public deployment is unverified.
- Remaining core verification: complete and reconcile the sandbox payment/evidence journey, verify a signed webhook, and test a second business/product. Remaining product work includes supplier discovery, image/physical evidence analysis and automated document delivery.

PayPal visual refresh (10 November 2026): shared navy/blue design across buyer workspace, request assistant, forms, supplier portal, evidence and settings; live-data next-step cards; branded sandbox approval handoff with cancellation and strict HTTPS sandbox-host validation. Handoff rendering was tested with a browser-only fixture, not a real payment. Dashboard illustration is decorative; counts and status labels remain sourced from stored records.

Verified locally on 9 November 2026. Business onboarding update: a new business starts with its own name and no sample records; Juniper is an explicitly selected demo only. Business profiles and initials are configurable, demo switching preserves the original business, and connected workspaces are bound to their authenticated owner. “Tested” below means the implemented path was exercised. PayPal transport tests are explicitly mocked and do not establish a real account connection.

Unified Requests update: `/requests/new` now provides a persistent OpenAI chat on the left and the complete editable request brief on the right. The separate supermarket navigation is removed; legacy `/demo` URLs open this same interface. Each request stores its own conversation and versioned draft. Named suppliers are ordinary buyer-entered contacts. Confirmed requests use the existing quote, agreement, evidence and payment journey. Sarvam submission and authenticated status refresh are available from normal request supplier controls, subject to existing provider/auth/consent gates. See [current setup](docs/REQUEST_ASSISTANT.md). OpenAI transport tests are mocked; no successful live OpenAI response is claimed.

## Implemented and tested locally

| Feature                    | Evidence / limits                                                                                                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsive buyer workspace | Actual Chrome at 1440, 1024 and 390 px; overview, requests, suppliers, payments, activity, settings, request tabs; no horizontal document overflow in the checked routes                                                      |
| Request assistant & editable form | Persistent request-specific chat, full editable business/product/delivery/budget/supplier/negotiation brief, explicit Save draft and Confirm request, private context files and reload persistence. OpenAI inference is schema-validated and mock-tested. |
| Requirement versions       | Frozen numbered versions and reference asset IDs; revision invalidates agreement approval; confirmed requests with provider orders cannot be revised in place                                                                 |
| Private files              | Fresh upload through the browser; MIME/extension/signature/size restrictions; authenticated download; original-document previews with real PDF rendering and embedded sample fonts                                            |
| Regular supplier directory | Browser creates and reloads a supplier; relationship and verification are separate; no invented completed order history                                                                                                       |
| Supplier quote portal      | Independent browser at 390 px submits/revises quotes; expiring hashed invitation; request scope, protected references, no buyer budget or competing offers; questions and explicit decline                                    |
| Quote normalization        | Integer minor units, server-calculated totals, explicit unknown tax/shipping, expiry/quantity/currency/requirement/deadline/budget checks                                                                                     |
| AG Grid Community          | Actual installed `ag-grid-react` and Community modules; sortable/filterable comparison, relationship/completeness filters, custom cells, evidence details and computed sourced recommendation                                 |
| Versioned agreement        | Buyer quote selection freezes quote/specification/file/amount/stage; supplier acceptance through private invitation; previous submissions cannot authorize a changed quote                                                    |
| Fresh document checks      | Real PDFs with wrong phone, missing required wording, correct content and untrusted instructions; failure blocks acceptance; each new file invalidates earlier acceptance                                                     |
| Human review               | Unknown visual/physical checks remain explicit; owner acknowledgment and separate acceptance; correction/question records preserved without pretending to send messages                                                       |
| Honest sample mode         | Fictional businesses/offers/sample transcript, future deadlines, no executable supplier phone numbers, no fake payment references or simulated financial success                                                              |
| Workspace isolation        | Separate sample browser contexts cannot read each other's files or perform actions on each other's requests; sample mode cannot access payment operations                                                                     |
| Financial domain controls  | Mocked transport tests cover provider approval, exact amount/currency, agreement, current acceptance, capture exactly once under concurrency, idempotent void, refund balance/duplicate protection and timeout reconciliation |
| Webhook policy             | Unsigned HTTP event rejected; duplicate/out-of-order event tests retrieve canonical state rather than trusting event order; verified HTTP events persist a reconciliation job                                                 |
| Durable storage and jobs   | SQLite WAL, migrations, foreign keys, unique operation lock, append-only audit triggers; separate persistent job worker; browser exercised queued document analysis                                                           |
| Accessibility basics       | Labelled controls, focus indicators, skip link, native modal focus management, mobile drawer focus management, reduced-motion styles and keyboard navigation                                                                  |
| Local record retrieval     | Search only sees records supplied by the workspace-scoped API; no Elastic connection claimed                                                                                                                                  |

The first seed includes three box quotes and one agreed stage. Other sample requests illustrate early workflow states; they do not imply external supplier responses or payments.

## Implemented but not verified against external accounts

| Feature                         | Exact boundary / prerequisite                                                                                                                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PayPal sandbox REST adapter     | OAuth preflight, AUTHORIZE order creation, actual buyer approval link, server-side approval verification, authorize/capture/void/refund and canonical reconciliation are implemented. No PayPal credentials, supplier business merchant or buyer test account were provided; no real sandbox transaction occurred. |
| PayPal webhook authentication   | Documented verify-webhook-signature REST flow and durable reconciliation are implemented. No registered HTTPS listener or real signed PayPal event was available. Simulator postback verification is intentionally unsupported.                                                                                    |
| Auth.js connected owner sign-in | GitHub OAuth and an owner-login allowlist are implemented. No OAuth app credentials were supplied, so actual sign-in/account switching was not exercised. Missing setup is visible.                                                                                                                                |
| Bounded Tavily discovery        | Actual documented Search API adapter, durable job, source URL/time/excerpt retention and deduplication are implemented. No API key was supplied; real results have not been retrieved.                                                                                                                             |
| Render deployment configuration | `render.yaml`, persistent disk path, generated signing secrets, startup supervision and health endpoint prepared. No service or disk was provisioned and no public deployment was performed.                                                                                                                       |

## Blocked / incomplete sponsor and provider work

| Feature                 | Blocker and remaining implementation                                                                                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| General Sarvam outreach | General automated calling remains blocked. The supermarket test-call adapter is implemented with explicit consent, allowlist, committed agent/version gate, persisted attempts, uncertain-launch redial blocking and authenticated status/transcript refresh. Credentials and actual account/destination testing remain external blockers. Automatic opt-out/fact extraction, follow-up and negotiation are incomplete. No actual call was made. |
| Sarvam callbacks        | Official payload reviewed; an account-specific documented authenticity mechanism was not established. Endpoint rejects all events rather than inventing a signature or accepting untrusted transcripts.                                                                                                                                     |
| Multimodal evidence review | No model evidence-approval adapter is implemented. Deterministic PDF checks work; physical/image/logo findings stay Unknown. The separate optional Gemini chat-intake adapter reads buyer-approved files into an unconfirmed draft; it cannot approve delivery or payment. |
| AG Studio               | No commercial key/trial or agent integration. The app explicitly uses AG Grid Community. AG Studio custom analytics/widgets, cross-filtering and natural-language agent features are not implemented.                                                                                                                                       |
| Elastic                 | No service/index/key. Local workspace records remain searchable. Ingestion, document retrieval and Elastic authorization filters still need implementation.                                                                                                                                                                                 |
| Email delivery          | Private links and correction/follow-up notes work locally; no mail provider, verified sender or delivery adapter is implemented. No messages are sent.                                                                                                                                                                                      |

## Deferred

- PayPal Invoicing/separate invoice collection, disputes, genuine shipment tracking and Bryntum timeline. A supermarket buyer-generated pro forma PDF is available and creates no charge. It is not a supplier tax invoice or receipt. Checkout remains the only collection route.
- Production merchant onboarding/permissions, arbitrary suppliers, multi-capture and partial capture, automated capture and reauthorization. This release uses a dedicated sandbox merchant, full-stage capture and explicit owner confirmation.
- A complete operator recovery UI for a provider mutation that timed out before returning any provider ID. Such operations stay locked and expose an error; recovery must be reconciled with the real PayPal dashboard/support record before any further mutation.
- Multi-workspace owner membership administration, PostgreSQL/Prisma migration, S3 adapter, horizontal scaling, antivirus and isolated hostile-file processing. The provided deployment is a single instance with a private persistent disk.
- AI negotiation, automatic transcript commercial-fact extraction, invoice amount checks, physical dimension/quantity verification and autonomous supplier outreach. Model-drafted supermarket briefs are implemented behind explicit Gemini setup; external model responses remain unverified.

## Checks run

- `npm run typecheck` — passed.
- `npm run lint` — passed with no warnings.
- `npm test` — 20 domain/intake/payment-policy tests passed, including checkout destination validation, OpenAI structured responses, private PDF context scoping, stale revisions and failure handling. Provider transports are explicitly mocked.
- `npm run test:e2e` — 9 actual Chrome journeys passed: business isolation, unified Requests assistant/manual confirmation and resume, supplier quote privacy, payment setup, mismatch/correction review, responsive layout and the PayPal handoff UI fixture. Legacy demo/wizard browser tests were replaced by the unified request journey; earlier pro forma checks describe the legacy route.
- `npm run build` — optimized production build passed.
- Browser screenshots inspected for overview, comparison, review and mobile supplier portal. A separately rendered original PDF preview was inspected to verify complete lettering after embedding fonts.

`npm audit --omit=dev` reported zero vulnerabilities after upgrading Auth.js to its patched release. The full development tree still reports eight moderate lint-tooling findings through `@typescript-eslint` / `minimatch`; resolving those requires a separately validated major tooling change. They are not part of the production dependency audit.

No successful live provider call, search result, model result, payment or deployment is claimed.
