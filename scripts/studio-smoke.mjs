import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:5175/";

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  const bodyText = await page.locator("body").innerText({ timeout: 10000 });
  let studioOpened = await page.locator(".product-shell").count() > 0;
  const studioButton = page.getByRole("button", { name: /生产工作台/ }).first();
  if (!studioOpened && await studioButton.count()) {
    await studioButton.click();
    await page.waitForTimeout(300);
    studioOpened = await page.locator(".product-shell").count() > 0;
  }
  const deliveryButton = page.locator(".product-sidebar button").filter({ hasText: /交付/ }).first();
  if (studioOpened && await deliveryButton.count()) {
    await deliveryButton.click();
    await page.waitForTimeout(300);
  }
  const deliveryVisible = await page.locator(".delivery-work-panel").count() > 0;
  const deliveryText = deliveryVisible ? await page.locator(".delivery-work-panel").innerText({ timeout: 5000 }) : "";
  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const result = {
    loaded: bodyText.length > 100,
    studioOpened,
    deliveryVisible,
    deliveryHasChecks: /交付|Manifest|审片|时间线/.test(deliveryText),
    desktopOverflow,
    mobileOverflow,
  };
  console.log(JSON.stringify(result));
  if (!result.loaded || !result.deliveryVisible || !result.deliveryHasChecks || result.desktopOverflow || result.mobileOverflow) process.exitCode = 1;
} finally {
  await browser.close();
}
