import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
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
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await page.goto(origin);
  await page.getByRole("button", { name: "Open sample walkthrough" }).click();
  await page
    .getByRole("heading", { name: "Purchasing overview." })
    .waitFor({ timeout: 60000 });
  const data = await page.evaluate(async () =>
    (await fetch("/api/workspace")).json(),
  );
  const request = data.requests.find((r) => r.code === "PP-1042");
  await mkdir("test-results/inspection", { recursive: true });
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, route] of [
      ["overview", "/"],
      ["requests", "/requests"],
      ["quotes", `/requests/${request.id}?tab=quotes`],
      ["review", `/requests/${request.id}?tab=review`],
      ["new-request", "/requests/new"],
      ["settings", "/settings"],
    ]) {
      await page.goto(origin + route);
      await page.locator("h1").waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (name === "quotes") await page.locator(".ag-root-wrapper").waitFor();
      console.log(
        name,
        width,
        await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          overflow: [...document.querySelectorAll("body *")]
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return (
                r.right > innerWidth + 0.1 &&
                r.width > 0 &&
                getComputedStyle(e).position !== "fixed"
              );
            })
            .slice(0, 12)
            .map((e) => ({
              tag: e.tagName,
              class: e.className,
              width: Math.round(e.getBoundingClientRect().width),
              right: Math.round(e.getBoundingClientRect().right),
            })),
        })),
      );
      await page.screenshot({
        path: `test-results/inspection/${name}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  }
} finally {
  await browser.close();
}
