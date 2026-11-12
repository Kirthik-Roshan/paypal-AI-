import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { id, one, run } from "../src/lib/db";
import { getData } from "../src/lib/domain";
import { seedWorkspace } from "../src/lib/seed";
import { invoiceAction, requestInvoice } from "../src/lib/providers/invoicing";
import type { Workspace } from "../src/lib/types";
import type { PaypalTransport } from "../src/lib/providers/paypal";
process.env.DATABASE_PATH = `/tmp/pp-invoice-${randomUUID()}.db`;
process.env.PAYPAL_MERCHANT_ID = "TEST-MERCHANT";
async function fixture() {
  const wid = id();
  await seedWorkspace(wid);
  run("UPDATE workspaces SET mode='sandbox' WHERE id=?", wid);
  const w = one<Workspace>("SELECT * FROM workspaces WHERE id=?", wid)!;
  const d = getData(w),
    r = d.requests.find((r) => r.code === "PP-1042")!,
    a = d.agreements.find((a) => a.request_id === r.id)!;
  run(
    "UPDATE suppliers SET merchant_id=? WHERE id=?",
    "TEST-MERCHANT",
    a.supplier_id,
  );
  return { w, r, a };
}
test("creates one real-provider draft request, verifies exact agreement and recipient, never sends or charges", async () => {
  const { w, r, a } = await fixture();
  let creates = 0;
  let body: any;
  const transport: PaypalTransport = async (path, method, payload) => {
    if (method === "POST") {
      assert.equal(path, "/v2/invoicing/invoices");
      creates++;
      body = payload;
      return { id: "INV2-TEST-1234" };
    }
    assert.equal(path, "/v2/invoicing/invoices/INV2-TEST-1234");
    return {
      id: "INV2-TEST-1234",
      status: "DRAFT",
      detail: body.detail,
      items: body.items,
      amount: body.items[0].unit_amount,
      primary_recipients: body.primary_recipients,
    };
  };
  const result = await invoiceAction(
    w,
    r.id,
    "create",
    "buyer@example.com",
    transport,
  );
  assert.equal(result.status, "DRAFT");
  assert.equal(creates, 1);
  assert.equal(body.items[0].unit_amount.value, (a.amount / 100).toFixed(2));
  await invoiceAction(w, r.id, "create", "other@example.com", transport);
  assert.equal(creates, 1);
  const other = await fixture();
  await assert.rejects(
    invoiceAction(other.w, r.id, "refresh", undefined, transport),
    /workspace/,
  );
  await assert.rejects(
    invoiceAction(w, r.id, "refresh", undefined, async () => ({
      id: "INV2-TEST-1234",
      detail: body.detail,
      amount: { currency_code: a.currency, value: "0.01" },
    })),
    /does not match/,
  );
  assert.equal(requestInvoice(w, r.id)?.status, "DRAFT");
});
test("unknown creation remains locked and can reconcile the exact invoice number", async () => {
  const { w, r } = await fixture();
  await assert.rejects(
    invoiceAction(w, r.id, "create", "buyer@example.com", async () => {
      throw Error("timeout");
    }),
    /uncertain/,
  );
  assert.equal(requestInvoice(w, r.id)?.status, "uncertain");
  await assert.rejects(
    invoiceAction(w, r.id, "create", "buyer@example.com", async () => {
      throw Error("must not call");
    }),
    /already exists/,
  );
  await assert.rejects(
    invoiceAction(w, r.id, "refresh", undefined, async (path) => {
      assert.equal(path, "/v2/invoicing/search-invoices");
      return {
        items: [{ id: "INV2-OTHER", detail: { invoice_number: "unrelated" } }],
      };
    }),
    /No unique invoice/,
  );
  assert.equal(requestInvoice(w, r.id)?.provider_id, null);
});
