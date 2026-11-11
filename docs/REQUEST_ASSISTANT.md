# Unified request assistant

Use **Requests → New request** (`/requests/new`). The buyer chats on the left and edits the request brief on the right. There is no separate supermarket/demo navigation or special supplier identity in this flow. All businesses use the same request, supplier, quotation, agreement and payment records. Legacy `/demo` URLs open the request assistant.

Every request has its own persistent conversation, workspace-scoped private context files and optimistic draft revision. A browser can resume its latest unfinished request; **Continue draft** opens an existing draft. Manual form edits are included in the next model turn. **Save draft** persists form edits without making a model call. **Confirm request** freezes the requirements and creates/reuses the buyer-entered supplier contacts; it does not contact anyone or pay.

## OpenAI setup

Set `OPENAI_API_KEY` and `OPENAI_INTAKE_MODEL` in `.env.local`, then restart the server. Use a model available to your account that supports Responses API structured output and PDF/image inputs. For a private local instance, set `LOCAL_AI_ENABLED=true`; otherwise connected owner authentication is required before a model call. No keys are exposed to the browser. Missing credentials, quota/auth errors, unusable output and stale revisions are visible and cannot become fabricated assistant success.

Implementation uses the official [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [file inputs](https://developers.openai.com/api/docs/guides/file-inputs). Requests use `store:false`; conversation history is kept in private SQLite storage. Buyer-selected latest three context files may be sent per turn, capped at 12 MB total. Supplier portals do not receive these private context assets.

The model returns validated draft fields and a follow-up reply. Unknown amounts/quantities stay unset; the model is instructed to ask about missing details and inconsistent product totals. Budget is stored as integer minor units. Only the buyer confirms. No model tool can call suppliers, select quotations, approve evidence or move money.

## Supplier journey

Confirmed requests appear in the normal supplier, quotation, evidence and payment tabs. Buyer-entered Prithish and Karthick are ordinary supplier contacts. Share each private quote link manually. **Call supplier** invokes the existing Sarvam adapter only after explicit contact consent, owner sign-in, allowlist, agent verification and outreach-hours checks. Provider transcript/status refresh is available on the call record. Unknown launches block redial. Real account connectivity remains unverified; written quotations and payment recipient verification remain separate steps.

PayPal still uses the configured sandbox merchant and simulated funds. Sponsor integrations and external-account limitations documented in FEATURE_STATUS.md remain in force. The former Gemini supermarket endpoint is retained only for backwards compatibility with old records; the Requests assistant uses OpenAI.
