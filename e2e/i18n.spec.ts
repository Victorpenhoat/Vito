import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

test("un écran module s'affiche en anglais via /en", async ({ page }) => {
  await login(page);
  await page.goto("/en/restos");
  // le titre de page restos en anglais (valeur EN de restos.title — à aligner avec la traduction)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/My restaurants|Restaurants/);
});
