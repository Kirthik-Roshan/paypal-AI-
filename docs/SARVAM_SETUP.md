# Sarvam supplier-call setup

The normal flow is **Requests → confirmed request → Suppliers & calls → Call supplier**. The adapter submits to Sarvam’s instant outbound API and refreshes status/transcript through authenticated Analytics requests. It does not need a public callback URL for manual refresh. Unauthenticated Sarvam callbacks remain rejected.

## 1. Create the English agent

Open [Sarvam Voice Agents](https://indus.sarvam.ai/). Create **ProcureProof Purchasing Assistant**, select English as the starting/allowed language, and choose an English voice. Use [the prepared greeting, variable definitions and prompt](SARVAM_AGENT_PROMPT.md). The two required input variables are `procurement_brief` and `supplier_name`. Keep them included in LLM context. Test the agent in Sarvam’s browser testing panel and commit the version you tested.

## 2. Connect telephony

Under **Deploy → Phone Numbers**, connect an existing supported telephony provider or obtain a number through Sarvam’s available rental flow. This is an account/billing action performed by the owner; the app does not buy numbers. A speech-model API key by itself does not supply a calling line. Verify outbound support for your actual destination before enabling calls.

## 3. Fill private environment settings

| Variable                     | Required value                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `SARVAM_API_KEY`             | Voice Agents workspace API key from Settings → API Key                                                                                      |
| `SARVAM_ORG_ID`              | Organization ID used by your Voice Agents API setup                                                                                         |
| `SARVAM_WORKSPACE_ID`        | Workspace ID for that same key and agent                                                                                                    |
| `SARVAM_APP_ID`              | Committed purchasing agent’s ID                                                                                                             |
| `SARVAM_APP_VERSION`         | Actual committed version number, a positive integer                                                                                         |
| `SARVAM_CONNECTION_ID`       | Connected telephony provider connection ID                                                                                                  |
| `SARVAM_AGENT_PHONE`         | Provisioned outbound caller number, with country code                                                                                       |
| `SARVAM_ALLOWED_NUMBERS`     | Comma-separated consenting supplier/test numbers in E.164 format, such as +91 followed by the actual number                                 |
| `SARVAM_DEMO_AGENT_VERIFIED` | Keep false until the committed agent and destination setup are verified; then set true. Legacy variable name, also used by normal Requests. |

Never commit keys or send them in chat. Use a key scoped to the relevant Voice Agents workspace. Restart the application after changing `.env.local`.

## 4. First application call

1. Sign into the connected owner workspace in Settings.
2. Confirm a request with **Call language = English** and the supplier’s actual phone.
3. Ensure the number exactly matches an entry in `SARVAM_ALLOWED_NUMBERS`.
4. Check the request’s outreach time window. New Requests currently default to **09:00–17:00** in the workspace time zone. Calls outside that window are blocked; no overnight call is silently scheduled.
5. Under **Suppliers & calls**, choose **Call supplier**, confirm that contact consented, and explicitly place the call.
6. Open the recorded conversation and choose **Refresh provider status**. An attempt ID only establishes submission; actual connection and transcript require provider evidence. Analytics data may lag or be cached for 60 seconds.

## Boundaries and recovery

### Correct variables but wrong spoken order

Open the call in **Suppliers & calls**, refresh provider status, then inspect **Call context**. New app calls retain the exact submitted `supplier_name`, `procurement_brief` and app/version; older calls explicitly have no saved outbound snapshot. Refresh also retrieves the matching interaction's final variables through Analytics. Final values establish what Sarvam retained, not which values the language model saw or followed.

If the returned brief is correct but the transcript uses another business/product, inspect that exact committed agent version in Sarvam. Verify both inputs are included in LLM context, remove conflicting examples or tools/hooks that change the brief, and test the revised version with two distinct briefs before committing and selecting its version in `.env.local`. A successful call with a hardcoded brief does not validate dynamic inputs. Do not fix this by hardcoding one customer's purchase or repeatedly redialling suppliers.

For diagnosis, the authenticated Analytics `interactions` endpoint exposes final `agent_variables` and `app_version`; `traces/{interaction_id}` exposes on-start and per-turn events. Match both interaction ID and attempt/job ID before attributing results to a call. Trace events may not expose the complete model system prompt. If the provider retains correct values but the model still ignores them with context inclusion enabled, send the attempt/interaction ID and a redacted example to Sarvam support.

The app records an attempt before submitting it, blocks duplicate unresolved attempts, observes do-not-contact settings and leaves network/5xx/invalid-response uncertainty locked against redial. If no attempt ID returned, check the real Sarvam dashboard before operator recovery. There is no automatic redial.

Refresh provider status releases the retry lock when the authenticated attempt includes a valid past `end_datetime`. This covers ended connected calls and ended unanswered attempts. Connectivity status alone does not establish that a call ended. After completion, the owner may explicitly place a new call with fresh consent; the previous attempt and transcript remain in history. Analytics responses may be cached for 60 seconds. Unknown or still-active attempts remain blocked.

Transcripts are evidence for owner review. The app does not automatically convert spoken terms into confirmed quotes or verify spoken payment identities. Use the private supplier portal for written offers. Review any opt-out and mark the supplier do not contact. Autonomous negotiation loops, automatic opt-out/fact extraction, scheduled polling and verified callbacks remain incomplete. PayPal Sandbox uses simulated funds; Sarvam calls use actual telephone infrastructure and may consume provider credits.

No account connection or real phone call is claimed merely because settings are present. Current transport tests are mocked.

Official sources: [Quickstart](https://docs.sarvam.ai/voice-agents/quickstart), [Voice Agents API keys](https://docs.sarvam.ai/voice-agents/settings/api-key), [Phone numbers](https://docs.sarvam.ai/voice-agents/deploy/telephony), [Create outbound call](https://docs.sarvam.ai/voice-agents/api/instant-outbound/create), [Analytics API](https://docs.sarvam.ai/voice-agents/api/analytics/overview).
