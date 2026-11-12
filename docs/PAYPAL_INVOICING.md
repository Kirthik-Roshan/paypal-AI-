# PayPal Sandbox invoice generation

Open a confirmed request, select a written quote and obtain both parties' agreement acceptance. In **Payments → PayPal invoice**, enter the buyer's invoice email and choose **Generate PayPal draft invoice**. The app calls the real PayPal Sandbox Invoicing v2 API using the existing configured supplier merchant credentials. Owner sign-in and supplier merchant mapping are required. No new invoice credential is needed, but PayPal account/API permissions must support Invoicing.

The frozen agreed total is represented as one inclusive agreement line, including quoted tax and shipping; it is not a recalculated per-unit tax invoice. The invoice number is tied to the agreement. The app retrieves PayPal's canonical record and checks its ID, invoice number, recipient, amount and currency before storing a verified snapshot.

**Refresh invoice** retrieves the saved invoice or searches by the deterministic invoice number after an uncertain creation result. Generation stays locked when the result is uncertain; do not delete the record to retry. One invoice attempt is recorded per agreement. Inspect rejected requests and unresolved attempts in the configured sandbox merchant's dashboard.

**Download draft PDF** renders the verified snapshot locally. It is labelled as a ProcureProof rendering of PayPal data, not a PayPal-issued PDF, tax invoice or payment receipt. Status comes from the latest verified snapshot; refresh before relying on it.

This implementation creates unsent drafts. It does not call the invoice send endpoint, email a payable invoice, collect invoice payments, mark checkout captures as invoice payments or infer payment eligibility from an invoice status. Existing Orders checkout remains the collection route. Sending payable invoices would require a separate mutually exclusive payment-flow design to avoid collecting twice.

Tests mock PayPal; no actual sandbox invoice is claimed by passing tests. Use the UI to validate with the configured account. API errors remain visible.

Official references: https://developer.paypal.com/invoicing/use-cases/ and https://developer.paypal.com/docs/api/invoicing/v2/
