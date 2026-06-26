import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

test("l'onglet Hôtels montre l'hôtel seedé", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels");
  await expect(page.getByTestId("places-tabs")).toBeVisible();
  await expect(page.getByTestId("place-card").filter({ hasText: "Hôtel Démo" }).first()).toBeVisible();
});

test("l'hôtel n'apparaît PAS dans Restos (getPlaces resto exclut les hôtels)", async ({ page }) => {
  await login(page);
  await page.goto("/fr/restos");
  await expect(page.getByTestId("places-tabs")).toBeVisible();
  await expect(page.getByTestId("place-card").filter({ hasText: "Hôtel Démo" })).toHaveCount(0);
});

test("ajouter un hôtel via la recherche externe", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels");
  await page.getByTestId("add-hotel-search").fill("hôtel");
  await expect(page.getByTestId("search-result").first()).toBeVisible();
  await page.getByTestId("search-result").first().getByRole("button").click();
  await page.getByTestId("tab-a-tester").click();
  await expect(page.getByTestId("place-card").first()).toBeVisible();
});
