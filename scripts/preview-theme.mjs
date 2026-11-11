import { chromium } from "@playwright/test";
const origin = process.env.TEST_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: "/opt/google/chrome/chrome",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1672, height: 1050 },
  });
  await page.goto(origin);
  await page
    .getByRole("textbox", { name: "Business name", exact: true })
    .fill("KIRTHIK'S HYPERMART");
  await page
    .getByRole("button", { name: "Create my business workspace" })
    .click();
  await page.goto(origin + "/requests/new");
  await page
    .getByRole("textbox", { name: /Request title/ })
    .fill("Soft-drink inventory restock");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByText("Request draft saved.", { exact: true }).waitFor();
  for (const width of [1672, 1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 1050 });
    for (const [name, path] of [
      ["overview", "/"],
      ["requests", "/requests"],
      ["assistant", "/requests/new"],
      ["settings", "/settings"],
    ]) {
      await page.goto(origin + path);
      await page.locator("h1").waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `test-results/paypal-${name}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      console.log(`${name} ${width}: ${overflow ? "OVERFLOW" : "fits"}`);
    }
  }
} finally {
  await browser.close();
}
