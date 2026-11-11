import { test, expect } from "@playwright/test";
test("normal Requests has private chat and full editable brief, persists and confirms a supermarket order", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Business name", exact: true })
    .fill("KIRTHIK'S HYPERMART");
  await page
    .getByRole("button", { name: "Create my business workspace" })
    .click();
  await page.goto("/requests/new");
  await expect(
    page.getByRole("heading", { name: "Your purchasing assistant" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your request brief" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Supermarket demo" }),
  ).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Hackathon");
  await page
    .getByRole("textbox", { name: "Request title", exact: false })
    .fill("Soft-drink inventory restock");
  await page.getByLabel("Category", { exact: true }).fill("Beverage wholesale");
  await page
    .getByRole("textbox", { name: "What do you need?", exact: false })
    .fill("Restock sealed soft drinks for the supermarket.");
  await page
    .getByRole("spinbutton", { name: "Quantity", exact: false })
    .fill("80");
  await page.getByLabel("Unit", { exact: true }).fill("cases");
  await page
    .getByLabel("Pack size / specification")
    .fill("24 × 250 ml cans per case");
  await page
    .getByLabel("Product mix", { exact: true })
    .fill("40 Coca-Cola, 20 Sprite, 20 Fanta Orange");
  await page
    .getByLabel("Delivery address", { exact: false })
    .fill("24 GST Road, Chromepet, Chennai, Tamil Nadu 600044");
  await page
    .getByLabel("Delivery deadline", { exact: false })
    .fill(new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10));
  await page.getByLabel("Total budget", { exact: false }).fill("900");
  await expect(page.getByLabel("Call language")).toHaveValue("English");
  for (const [i, name] of ["Prithish", "Karthick"].entries()) {
    await page.getByRole("button", { name: "Add supplier" }).click();
    await page.getByLabel(`Supplier ${i + 1} name`).fill(name);
    await page.getByLabel(`Supplier ${i + 1} phone`).fill(`+91987654321${i}`);
  }
  await page
    .getByLabel("Stock / quality requirements")
    .fill("Sealed cases and at least six months before expiry");
  await page.getByLabel("Supplier 1 phone").fill("9876543210");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByLabel("Supplier 1 phone")).toBeFocused();
  await expect(page.getByLabel("Supplier 1 phone")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator(".intake-supplier").first()).toContainText(
    "Add the country code, starting with +.",
  );
  await page.screenshot({
    path: "test-results/request-contact-validation.png",
    animations: "disabled",
  });
  await page.getByLabel("Supplier 1 phone").fill("+91 98765-43210");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByText("Request draft saved.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("spinbutton", { name: /Quantity/ })).toHaveValue(
    "80",
  );
  await expect(page.getByLabel("Supplier 1 name")).toHaveValue("Prithish");
  await expect(page.getByLabel("Supplier 1 phone")).toHaveValue(
    "+919876543210",
  );
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({
      path: `test-results/request-chat-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("checkbox", {
      name: "I reviewed these requirements",
      exact: false,
    })
    .check();
  await page
    .getByRole("button", { name: "Confirm request", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Soft-drink inventory restock",
      exact: true,
    }),
  ).toBeVisible();
  const data = await page.evaluate(async () =>
    (await fetch("/api/workspace")).json(),
  );
  expect(data.requests[0].spec.quantity).toBe(80);
  expect(data.requests[0].spec.language).toBe("English");
  expect(data.suppliers).toHaveLength(2);
  expect(data.calls).toHaveLength(0);
  expect(data.quotes).toHaveLength(0);
  const response = await page.request.post("/api/action", {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      action: "invitation.create",
      requestId: data.requests[0].id,
      data: {
        supplierId: data.suppliers.find(
          (s: { company: string }) => s.company === "Prithish",
        ).id,
      },
    },
  });
  expect(response.ok()).toBe(true);
  const invitation = await response.json();
  const supplierContext = await browser.newContext();
  const supplierPage = await supplierContext.newPage();
  await supplierPage.goto(new URL(invitation.url, page.url()).toString());
  const panel = supplierPage
    .locator("section")
    .filter({
      has: supplierPage.getByRole("heading", {
        name: "Sandbox payment contact",
        exact: true,
      }),
    });
  await panel
    .getByRole("textbox", { name: "Sandbox business email or merchant ID" })
    .fill("not valid");
  await panel.getByRole("button", { name: "Confirm sandbox contact" }).click();
  await expect(panel.getByRole("alert")).toContainText(
    "Enter a sandbox business email or merchant ID.",
  );
  await panel
    .getByRole("textbox", { name: "Sandbox business email or merchant ID" })
    .fill("TESTMERCHANT123");
  await panel.getByRole("button", { name: "Confirm sandbox contact" }).click();
  await expect(panel.getByRole("status")).toContainText(
    "Sandbox contact saved.",
  );
  await supplierPage.reload();
  await expect(panel.getByRole("status")).toContainText(
    "Sandbox contact saved.",
  );
  const portalState = await supplierPage.request.get(
    new URL(
      "/api/portal/" + invitation.url.split("/").pop(),
      page.url(),
    ).toString(),
  );
  const saved = await portalState.json();
  expect(saved.paymentContact).toBe("TESTMERCHANT123");
  expect(saved.quotes).toHaveLength(0);
  expect(saved.agreement).toBeNull();
  await panel
    .getByRole("link", { name: "Continue to written quotation", exact: false })
    .click();
  await expect(supplierPage.locator("#written-quotation")).toBeInViewport();
  await supplierContext.close();
});
