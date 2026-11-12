import { test, expect } from "@playwright/test";
test("supplier reviews prefilled call terms without inventing unknown costs or confirming requirements", async ({
  page,
}) => {
  const fields: Record<
    string,
    { value: string | null; evidence: string | null }
  > = Object.fromEntries(
    [
      "quantity",
      "currency",
      "unitPrice",
      "priceUnit",
      "shipping",
      "tax",
      "completionDate",
      "validUntil",
      "paymentTerms",
      "exclusions",
      "paymentContact",
    ].map((k) => [k, { value: null, evidence: null }]),
  );
  fields.quantity = { value: "4", evidence: "4 cases" };
  fields.unitPrice = { value: "1.25", evidence: "USD 1.25 per case" };
  fields.currency = { value: "USD", evidence: "USD 1.25 per case" };
  fields.priceUnit = { value: "cases", evidence: "USD 1.25 per case" };
  await page.route("**/api/portal/*", (route) =>
    route.fulfill({
      json: {
        title: "Cola restock",
        code: "PP-1042",
        version: 1,
        buyer: "Hypermart",
        supplier: { company: "Prithish" },
        requirements: {
          description: "Cola",
          quantity: 4,
          unit: "cases",
          material: "24 × 250 ml",
          deadline: "2026-11-20",
          destination: "Chennai",
        },
        assets: [],
        quotes: [],
        agreement: null,
        expires: "2026-11-20",
        sample: false,
        demo: false,
        paymentContact: "",
        callDraft: { callId: "mock-call", fields },
      },
    }),
  );
  await page.goto("/quote/" + "a".repeat(64));
  await expect(
    page.getByText("Your call terms have been prefilled", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Unit price", { exact: false })).toHaveValue(
    "1.25",
  );
  await expect(page.getByLabel("Shipping", { exact: false })).toHaveValue("");
  await expect(page.getByLabel("Tax", { exact: false })).toHaveValue("");
  await page.screenshot({
    path: "test-results/supplier-call-prefill.png",
    fullPage: true,
  });
});
