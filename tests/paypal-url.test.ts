import assert from "node:assert/strict";
import { test } from "node:test";
import { isSandboxApprovalUrl } from "../src/lib/paypal-approval-url";
test("checkout handoff accepts only HTTPS PayPal sandbox URLs without embedded credentials", () => {
  assert.equal(
    isSandboxApprovalUrl(
      "https://www.sandbox.paypal.com/checkoutnow?token=TEST",
    ),
    true,
  );
  assert.equal(
    isSandboxApprovalUrl("https://sandbox.paypal.com/checkoutnow?token=TEST"),
    true,
  );
  for (const url of [
    "http://www.sandbox.paypal.com/checkoutnow",
    "https://www.paypal.com/checkoutnow",
    "https://www.sandbox.paypal.com.evil.example/checkoutnow",
    "https://user:pass@www.sandbox.paypal.com/checkoutnow",
    "javascript:alert(1)",
    "/checkoutnow",
    "https://www.sandbox.paypal.com:444/checkoutnow",
  ])
    assert.equal(isSandboxApprovalUrl(url), false, url);
});
