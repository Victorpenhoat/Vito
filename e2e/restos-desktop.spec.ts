import { test, expect } from "@playwright/test";
import { login } from "./helpers";

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

// Liste + détail sur grand écran : la fiche s'ouvre À CÔTÉ de la liste, sans
// la remplacer. Sur téléphone, c'est la fiche seule — les specs mobiles le
// vérifient déjà en ouvrant /restos/<id>.
test.describe("liste + détail (desktop)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("ouvrir une adresse garde la liste à côté, et la met en évidence", async ({ page }) => {
    await login(page, "client@vito.test");
    await page.goto("/fr/restos?onglet=tous");
    const carte = page.getByTestId("place-card").first();
    await expect(carte).toBeVisible();
    await carte.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/fr\/restos\/[0-9a-f-]{36}/);

    // les deux colonnes sont là
    await expect(page.getByTestId("places-detail")).toBeVisible();
    await expect(page.getByTestId("restos-tabs")).toBeVisible();
    // l'adresse ouverte est repérable dans la liste
    await expect(page.locator('[data-selected="true"]').first()).toBeVisible();

    // changer de sous-onglet depuis la fiche ramène à la liste
    await page.getByTestId("tab-favoris").click();
    await expect(page).toHaveURL(/\/fr\/restos$/);
  });

  test("sur téléphone, la fiche reste seule", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, "client@vito.test");
    await page.goto("/fr/restos?onglet=tous");
    await page.getByTestId("place-card").first().getByRole("link").first().click();
    await expect(page).toHaveURL(/\/fr\/restos\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("places-detail")).toBeVisible();
    await expect(page.getByTestId("restos-tabs")).toBeHidden();
  });
});
