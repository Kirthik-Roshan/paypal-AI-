# Supermarket hackathon

This document describes legacy compatibility paths. The current interface is the unified **Requests → New request** assistant, with OpenAI chat and the full brief beside it. There is no separate supermarket navigation. Use [REQUEST_ASSISTANT.md](REQUEST_ASSISTANT.md) for current setup.

Open your own business workspace, then **Supermarket demo** (`/demo`). This adds a labelled draft; it does not rename the business or replace existing requests. Juniper remains a separate optional fictional walkthrough.

## Buyer chat

Type what you need and upload stock documents or shelf photos. Chat persists history, extracts a draft and asks for missing fields. Review and explicitly confirm the brief. There is no inventory-system connection or autonomous purchase.

Without model credentials, a clearly labelled local parser supports explicit patterns such as `40 cases`, `24 x 250 ml`, `budget USD 600`, `deliver to …`, `2026-12-01`, `Prithish +91…`, `Karthick +91…` and supported language names. This fallback cannot understand arbitrary phrasing or interpret files.

For flexible language and PDF/image inference, set `GEMINI_API_KEY` and `GEMINI_INTAKE_MODEL` to a model available in your account. A private local demo also requires `DEMO_LOCAL_AI_ENABLED=true`; otherwise connect owner sign-in. The adapter uses [Generate Content](https://ai.google.dev/api/generate-content) with validated structured JSON. Actual account connectivity is unverified. Quota, blocked-response and schema errors surface without fabricated responses.

Uploads have a private **Buyer context** role, excluded from supplier references. Only when the buyer checks the inclusion box are the latest three context files sent to Gemini (12 MB total per turn). Model outputs and document instructions cannot invoke discovery, calls, orders or payments. All inferred fields require buyer review.

## Prithish and Karthick

Prithish is Regular; Karthick is a teammate playing the nearby alternative, not a claimed Google discovery. No numbers, quotations, calls or payments are seeded. Supply their actual phones with country codes in chat. Confirm the brief and create separate private expiring quote links. Share each link manually with the correct teammate; email/SMS delivery is not implemented.

Teammates submit actual written offers, delivery dates and sandbox payment contacts through their portals. Buyer budget, chat, private context and competing offers remain hidden. Phone-provided account details remain unverified; a written contact cannot redirect money.

The buyer refreshes offers and uses the normal AG Grid journey. Recommendation is the cheapest complete eligible current offer, including tax and shipping. Buyer selection freezes the agreement; the selected supplier must accept and submit evidence.

## External setup

- **Google Places:** configure `GOOGLE_PLACES_API_KEY`, enable Places API (New) with billing, restrict the key and connect owner sign-in. [Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/text-search) returns up to two beverage wholesalers around the supplied address. Results are temporary and attributed; candidates need human review and are never automatically called or saved as verified suppliers. Public hosting needs the operator’s public privacy policy and terms under Google’s policies.
- **Sarvam:** see [SARVAM_SETUP.md](SARVAM_SETUP.md). The demo has a real outbound adapter and authenticated Analytics refresh. Each launch requires explicit owner confirmation and a consenting allowlisted number. The committed agent must consume `procurement_brief` and `supplier_name`; verify destination support before enabling. A saved attempt is not proof of connection. Unknown launch results block redial. Transcripts do not become confirmed quotes or verified payment recipients. Review opt-outs; no automatic follow-up or negotiation loop runs.
- **PayPal:** configure the dedicated supplier sandbox business app and separate buyer test account, then connect owner sign-in. A demo supplier must confirm the configured sandbox merchant ID in the private portal before owner mapping. Email alone does not establish identity. Existing buyer approval, authorization, fresh evidence acceptance, capture, void and refund controls remain in force.

**Authorization is not legal escrow.** Only the single configured sandbox merchant can receive checkout funds. Arbitrary merchant onboarding/payouts remain unimplemented. Explicitly choose a currency supported by the test merchant; INR support must be established with PayPal before trying that currency.

## Invoice boundary

After selecting an offer, **Download pro forma** generates an actual PDF from the frozen agreement. It is a buyer purchase summary, marked **not a tax invoice or proof of payment**, and creates no charge. The supplier uploads their own invoice as evidence. PayPal Invoicing and automatic invoice amount validation remain unimplemented; there is no second collection path.

Readable evidence PDFs can include `Quantity: N` for deterministic quantity checks. Seals, expiry, pack size, physical count and delivered condition require human inspection. Unknown does not mean verified. Payment requires a separate explicit owner decision.

## Verification boundary

Domain tests cover parser/model validation, scoped attachments, call-attempt persistence, timeout redial blocking, canonical transcript refresh and real result preservation through explicit mock transports. Browser tests exercise typed changes/reload, private uploads, two independent written quotes, selection, pro forma bytes, responsive layouts and the unpaid payment boundary. No actual Gemini response, Places listing, Sarvam call or PayPal transaction has been verified.
