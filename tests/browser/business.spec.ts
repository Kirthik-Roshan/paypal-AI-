import { test, expect } from "@playwright/test";
test("any business starts empty, can rename, and can return from an isolated optional demo", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Your business. Your purchasing workspace.",
    }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Business name", exact: true })
    .fill("Northstar Design Studio");
  await page
    .getByRole("button", { name: "Create my business workspace" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Purchasing overview." }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Juniper");
  await expect(page.locator("body")).not.toContainText(
    "Branded takeaway boxes",
  );
  const own = await page.evaluate(async () =>
    (await fetch("/api/workspace")).json(),
  );
  expect(own.workspace.name).toBe("Northstar Design Studio");
  expect(own.workspace.mode).toBe("local");
  for (const key of ["requests", "suppliers", "quotes", "payments", "assets"])
    expect(own[key]).toHaveLength(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/business-390.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/settings");
  await page
    .getByRole("textbox", { name: "Business name", exact: true })
    .fill("Northstar Supplies");
  await page.getByRole("button", { name: "Save business details" }).click();
  await expect(page.getByText("Business details saved.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Business name", exact: true }),
  ).toHaveValue("Northstar Supplies");
  await page
    .getByRole("button", { name: "Sample walkthrough", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "Purchasing overview." }),
  ).toBeVisible();
  await expect(page.locator(".workspace-switch")).toContainText(
    "Juniper Coffee Studio",
  );
  await page.goto("/settings");
  await page.getByRole("button", { name: "Return to my business" }).click();
  await expect(
    page.getByRole("heading", { name: "Purchasing overview." }),
  ).toBeVisible();
  const restored = await page.evaluate(async () =>
    (await fetch("/api/workspace")).json(),
  );
  expect(restored.workspace.id).toBe(own.workspace.id);
  expect(restored.workspace.name).toBe("Northstar Supplies");
  expect(restored.requests).toHaveLength(0);
  await expect(page.locator("body")).not.toContainText("Juniper");
  const other = await browser.newContext({
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3000",
  });
  const second = await other.newPage();
  await second.goto("/");
  await second
    .getByRole("textbox", { name: "Business name", exact: true })
    .fill("Beacon Wholesale");
  await second
    .getByRole("button", { name: "Create my business workspace" })
    .click();
  await expect(
    second.getByRole("heading", { name: "Purchasing overview." }),
  ).toBeVisible();
  const state = await second.evaluate(async () =>
    (await fetch("/api/workspace")).json(),
  );
  expect(state.workspace.id).not.toBe(own.workspace.id);
  expect(state.workspace.name).toBe("Beacon Wholesale");
  await other.close();
});
test("legacy demo sessions require an explicit choice instead of opening Juniper by default", async ({
  page,
}) => {
  const origin = process.env.TEST_BASE_URL || "http://localhost:3000";
  const seeded = await page.request.post("/api/session", {
    headers: { Origin: origin },
    data: { mode: "sample" },
  });
  expect(seeded.ok()).toBe(true);
  await page.goto("/requests/an-old-demo-request");
  await expect(
    page.getByRole("button", { name: "Create my business workspace" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Juniper");
});
