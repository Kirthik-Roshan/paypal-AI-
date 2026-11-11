import { expect, test, type Page } from "@playwright/test";
async function open(page: Page) {
  await page.goto("/");
  const setup = page.getByRole("button", { name: "Open sample walkthrough" });
  await expect(setup).toBeVisible();
  await setup.click();
  await expect(
    page.getByRole("heading", { name: "Purchasing overview." }),
  ).toBeVisible();
  return page.evaluate(async () => (await fetch("/api/workspace")).json());
}
async function action(
  page: Page,
  action: string,
  requestId: string,
  data?: unknown,
) {
  return page.evaluate(
    async (payload) => {
      const r = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return { status: r.status, data: await r.json() };
    },
    { action, requestId, data },
  );
}
test("responsive overview and functional navigation at 1440, 1024 and 390 pixels", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const d = await open(page);
  const r = d.requests.find((r: any) => r.code === "PP-1042");
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Purchasing overview." }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `test-results/overview-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("complementary", { name: "Primary navigation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close navigation" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(() => !!document.activeElement?.closest(".sidebar")),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  for (const route of [
    "/requests",
    "/suppliers",
    "/payments",
    "/activity",
    "/settings",
    "/requests/new",
    `/requests/${r.id}?tab=quotes`,
    `/requests/${r.id}?tab=review`,
  ]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    await page.waitForTimeout(300);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/requests/${r.id}?tab=quotes`);
  await expect(
    page.getByRole("columnheader", { name: "Supplier", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/quotes-1440.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.goto(`/requests/${r.id}?tab=review`);
  await page.screenshot({
    path: "test-results/review-1440.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
test("wrong phone pauses eligibility; a corrected document gets fresh checks and human acceptance", async ({
  page,
}) => {
  const d = await open(page);
  const r = d.requests.find((r: any) => r.code === "PP-1042");
  await page.goto(`/requests/${r.id}?tab=review`);
  await page
    .getByRole("button", { name: "Run document checks", exact: true })
    .click();
  await expect(
    page.getByText("Payment paused. A requirement doesn’t match."),
  ).toBeVisible();
  await expect(
    page.getByText("Required text “202-555-0147” was not found", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept this stage", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: "test-results/evidence-mismatch.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Request correction", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record decision", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByLabel("Example artwork to load").selectOption("correct");
  await page.getByRole("button", { name: "Load example" }).click();
  await page
    .getByRole("button", { name: "Run document checks", exact: true })
    .click();
  await expect(page.getByText("4 pass")).toBeVisible();
  await page
    .getByLabel(
      "I reviewed the actual file, visual requirements and all unknown checks.",
    )
    .check();
  await page
    .getByRole("button", { name: "Accept this stage", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm acceptance", exact: true })
    .click();
  await expect(
    page.getByText("Evidence accepted for submission v2."),
  ).toBeVisible();
  await page.goto(`/requests/${r.id}?tab=payments`);
  await expect(
    page.getByText("No funds captured", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Connect PayPal sandbox" }),
  ).toBeVisible();
  const state = await page.evaluate(async () =>
    (await fetch("/api/workspace")).json(),
  );
  expect(
    state.payments.find((p: any) => p.request_id === r.id).capture_id,
  ).toBeNull();
});
test("regular supplier creation persists without invented order history", async ({
  page,
}) => {
  await open(page);
  await page.goto("/suppliers");
  await page.getByRole("button", { name: "Add supplier", exact: true }).click();
  await page.getByLabel("Company name").fill("Fresh Paper Studio");
  await page.getByLabel("Contact person").fill("Casey Example");
  await page
    .getByLabel("Email", { exact: true })
    .fill("quotes@freshpaper.example");
  await page.getByLabel("Location", { exact: true }).fill("Portland, US");
  await page
    .getByRole("button", { name: "Save supplier", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fresh Paper Studio" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Fresh Paper Studio" }),
  ).toBeVisible();
});

test("existing draft resumes and missing PayPal setup is reported honestly", async ({
  page,
}) => {
  const d = await open(page);
  const draft = d.requests.find((r: any) => r.version === 0);
  await page.goto(`/requests/${draft.id}`);
  await page.getByRole("link", { name: "Continue draft" }).click();
  await expect(
    page.getByRole("textbox", { name: /Request title/ }),
  ).toHaveValue(draft.title);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Run preflight" }).click();
  await expect(page.getByText("Last checked", { exact: false })).toBeVisible();
  await expect(
    page.getByText("Connect PayPal sandbox in Settings. Missing:", {
      exact: false,
    }),
  ).toBeVisible();
});
test("supplier portal submits and revises scoped offers; other workspace assets remain inaccessible", async ({
  page,
  browser,
}) => {
  const d = await open(page);
  const r = d.requests.find((r: any) => r.code === "PP-1042");
  const supplier = d.suppliers.find((s: any) => s.company === "Paper & Form");
  const invitation = await action(page, "invitation.create", r.id, {
    supplierId: supplier.id,
  });
  expect(invitation.status).toBe(200);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3000",
  });
  const portal = await ctx.newPage();
  await portal.goto(invitation.data.url);
  await expect(
    portal.getByRole("heading", {
      name: "Good work starts with a clear brief.",
    }),
  ).toBeVisible();
  expect(
    await portal.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const token = invitation.data.url.split("/").pop();
  const publicData = await portal.request.get(`/api/portal/${token}`);
  const portalData = await publicData.json();
  expect(portalData.requirements.budget).toBeUndefined();
  expect(
    portalData.quotes.every((q: any) => q.supplier_id === supplier.id),
  ).toBe(true);
  await portal.getByLabel("Unit price", { exact: false }).fill("1.90");
  await portal.getByLabel("Shipping / delivery").fill("25.00");
  await portal.getByLabel("Tax", { exact: true }).fill("");
  await portal
    .getByLabel("Completion / delivery date")
    .fill(new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10));
  await portal
    .getByLabel("Quote valid until")
    .fill(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  await portal
    .getByLabel("Payment terms", { exact: false })
    .fill("Full amount after artwork approval.");
  await portal
    .getByLabel("I can meet the confirmed requirements", { exact: false })
    .check();
  await portal
    .getByRole("button", { name: "Submit revision", exact: true })
    .click();
  await expect(
    portal.getByText("Written quote version 2 submitted.", { exact: false }),
  ).toBeVisible();
  await portal.getByLabel("Tax", { exact: true }).fill("0");
  await portal
    .getByRole("button", { name: "Submit revision", exact: true })
    .click();
  await expect(
    portal.getByText("Written quote version 3 submitted.", { exact: false }),
  ).toBeVisible();
  await portal.screenshot({
    path: "test-results/supplier-portal-390.png",
    fullPage: true,
    animations: "disabled",
  });
  const other = await browser.newContext({
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3000",
  });
  const otherPage = await other.newPage();
  const otherData = await open(otherPage);
  const protectedFile = await otherPage.request.get(
    `/api/assets/${d.assets[0].id}`,
  );
  expect(protectedFile.status()).toBe(404);
  const wrongAction = await action(otherPage, "review.analyze", r.id);
  expect(wrongAction.status).toBe(404);
  expect(otherData.workspace.id).not.toBe(d.workspace.id);
  const unsigned = await portal.request.post("/api/webhooks/paypal", {
    data: {
      id: "UNSIGNED",
      resource: {},
      event_type: "PAYMENT.CAPTURE.COMPLETED",
    },
  });
  expect([401, 503]).toContain(unsigned.status());
  await ctx.close();
  await other.close();
});
