import { test, expect } from "@playwright/test";
test("PayPal-themed overview uses real counts and navigation; checkout handoff uses an explicit UI test fixture", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open sample walkthrough" }).click();
  await expect(
    page.getByRole("heading", { name: "Purchasing overview." }),
  ).toBeVisible();
  await expect(page.locator(".sidebar-paypal")).toContainText("Powered by");
  await expect(page.locator(".overview-banner")).toContainText(
    "Better deals. Verified work.",
  );
  const d = await page.evaluate(async () =>
    (await fetch("/api/workspace")).json(),
  );
  const r = d.requests.find((r: any) => r.code === "PP-1042");
  // Explicit browser-only fixture: no provider call, token or payment is created.
  await page.route("**/api/workspace", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.workspace.mode = "sandbox";
    const p = data.payments.find((p: any) => p.request_id === r.id);
    p.approval_url =
      "https://www.sandbox.paypal.com/checkoutnow?token=UI-TEST-ONLY";
    await route.fulfill({ response, json: data });
  });
  await page.route("https://www.sandbox.paypal.com/**", (route) =>
    route.abort(),
  );
  await page.goto(`/requests/${r.id}?tab=payments`);
  await page.getByRole("button", { name: "Open buyer approval" }).click();
  await expect(
    page.getByRole("heading", { name: "Continue to PayPal", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("PayPal Sandbox · simulated funds", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/paypal-handoff-ui-fixture.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Stay here" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
