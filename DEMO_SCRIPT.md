# ProcureProof — a three-minute walkthrough

For the supermarket hackathon with Prithish and Karthick, use [the dynamic chat demo](docs/SUPERMARKET_DEMO.md). The Juniper script below remains a separate fictional example.

## 1. A clear request and an honest comparison

Start `npm run dev` and open localhost:3000. The default flow creates your own empty business workspace. For this optional demonstration, explicitly choose **Open sample walkthrough**. Point out **Sample walkthrough**. All companies and offers are fictional; no calls or payments are being simulated.

Open **Branded takeaway boxes → Summary**: 500 boxes, exact phone `202-555-0147`, `PLEASE RECYCLE`, explicit dimensions, future deadline and total budget.

Open **Quotes**. The real AG Grid Community comparison shows Evergreen’s complete $1,179 USD total. Paper & Form misses the deadline. Northline has unknown tax, so it has no complete total and cannot be selected. The recommendation states its actual basis.

## 2. Evidence stops an incorrect stage

Open **Files & review → Run document checks**. The original submitted PDF contains `202-555-0199`. Expand the exact-text finding and open the source PDF. The failed check blocks acceptance. **Request correction** records a note without pretending to email it.

Show **Payments**: no funds are authorized or captured and there is no provider reference. The sample workspace cannot execute financial operations.

## 3. A correction needs fresh acceptance

Return to **Files & review**. Choose **Correct submission → Load example**, then run fresh checks. Four deterministic document-text checks pass. Logo appearance, material and physical quality remain human-review items.

Inspect the actual rendered PDF and acknowledge the unknown/visual checks. Choose **Accept this stage → Confirm acceptance**. The request is ready for a separate payment review. Acceptance itself never moves funds.

Try **Missing required wording** to demonstrate that a different fresh file produces a new result and invalidates prior acceptance.

## 4. Fresh input and the supplier’s view

Create a request using the five-step form and upload a new PDF. Save a supplier and configure a region/contact ceiling. In **Suppliers & calls**, create a private quotation link. Open it in a private browser: submit a written quote, revise it and see the version number. The portal cannot see the buyer budget or other suppliers’ bids.

## Optional real sandbox segment — only after setup

Use an owner-authenticated connected sandbox and the dedicated configured supplier merchant. Create a fresh request and quote, obtain buyer and supplier agreement, create an AUTHORIZE order, complete actual buyer approval on PayPal and explicitly verify/authorize on return. Review evidence, accept it, then separately confirm capture. Show only the real returned provider reference and verified status. Void an unused authorization or refund an original capture as appropriate.

Without those credentials/accounts, end at **Settings → PayPal setup requirements**. Say that the local journey and mocked payment-policy tests work, while a real sandbox transaction remains unverified. Never present the sample as a successful PayPal payment or Sarvam call.
