import { chromium } from "@playwright/test";
const origin = process.env.TEST_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/opt/google/chrome/chrome",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto(origin);
  await page.getByRole("button", { name: "Open sample walkthrough" }).click();
  await page.getByRole("heading", { name: "Purchasing overview." }).waitFor();
  const data = await page.evaluate(async () =>
    (await fetch("/api/workspace")).json(),
  );
  const request = data.requests.find((r) => r.code === "PP-1042");
  await page.goto(`${origin}/requests/${request.id}?tab=review`);
  await page
    .getByRole("button", { name: "Run document checks", exact: true })
    .click();
  await page
    .getByText("Payment paused. A requirement doesn’t match.")
    .waitFor();
  const toast = page.getByRole("button", { name: "Dismiss notification" });
  if (await toast.isVisible()) await toast.click();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: "docs/screenshots/evidence-mismatch.png",
    fullPage: true,
    animations: "disabled",
  });
  console.log(
    "Captured actual mismatch evidence with the page at its initial scroll position.",
  );
} finally {
  await browser.close();
}
