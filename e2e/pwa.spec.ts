import { test, expect } from "@playwright/test";

test("manifest PWA lié et valide", async ({ page }) => {
  await page.goto("/fr");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest.name).toBeTruthy();
  expect(manifest.start_url).toBeTruthy();
  expect(manifest.display).toBe("standalone");
  expect(Array.isArray(manifest.icons) && manifest.icons.length).toBeTruthy();
});

test("service worker enregistré + /sw.js servi", async ({ page }) => {
  await page.goto("/fr");
  const sw = await page.request.get("/sw.js");
  expect(sw.status()).toBe(200);
  // le PwaRegister enregistre /sw.js après montage — attendre la registration
  await expect
    .poll(async () => page.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration())), {
      timeout: 10000,
    })
    .toBe(true);
});
