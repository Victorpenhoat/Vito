import { test, expect } from "@playwright/test";

test("la page kit UI s'affiche", async ({ page }) => {
  await page.goto("/fr/ui-kit");
  await expect(page.getByTestId("ui-kit")).toBeVisible();
  await expect(page.getByText("Kit UI — Vito")).toBeVisible();
});

test("le toggle de thème bascule data-theme sur <html>", async ({ page }) => {
  await page.goto("/fr/ui-kit");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", "light");
});

test("la modale s'ouvre et se ferme", async ({ page }) => {
  await page.goto("/fr/ui-kit");
  await expect(page.getByTestId("modal")).toHaveCount(0);
  await page.getByRole("button", { name: "Ouvrir la modale" }).click();
  await expect(page.getByTestId("modal")).toBeVisible();
  await page.getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByTestId("modal")).toHaveCount(0);
});
