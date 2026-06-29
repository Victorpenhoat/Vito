import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("onglet Carte : panneau liste deux-panneaux visible sur desktop", async ({ page }) => {
    await login(page);
    await page.goto("/fr/restos");
    await page.getByTestId("tab-carte").click();
    await expect(page.getByTestId("places-map")).toBeVisible();
    await expect(page.getByTestId("map-list")).toBeVisible();
    await expect(page.getByTestId("map-list-item").first()).toBeVisible();
  });
});

test.describe("mobile (non-régression)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("onglet Carte : panneau liste masqué sur mobile (carte pleine largeur)", async ({ page }) => {
    await login(page);
    await page.goto("/fr/restos");
    await page.getByTestId("tab-carte").click();
    await expect(page.getByTestId("places-map")).toBeVisible();
    await expect(page.getByTestId("map-list")).toBeHidden();
  });
});
