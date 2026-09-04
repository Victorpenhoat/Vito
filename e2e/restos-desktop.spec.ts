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

// Volet de filtres : sur grand écran, ils tiennent tous visibles dans un rail à
// gauche. Sur téléphone, ils restent empilés au-dessus de la liste.
test.describe("volet de filtres (desktop)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("le rail rassemble les filtres, qui continuent de filtrer", async ({ page }) => {
    await login(page, "client@vito.test");
    await page.goto("/fr/restos?onglet=a_tester");

    const rail = page.getByTestId("places-filtres");
    await expect(rail).toBeVisible();
    // recherche, vues et filtres contextuels vivent dans le rail
    await expect(rail.getByTestId("places-search")).toBeVisible();
    await expect(rail.getByTestId("view-vignettes")).toBeVisible();
    await expect(rail.getByTestId("origine-reco")).toBeVisible();

    // et ils filtrent toujours : le Comptoir du seed est une reco de Camille
    const avant = await page.getByTestId("place-card").count();
    expect(avant).toBeGreaterThanOrEqual(1);
    await rail.getByTestId("places-search").fill("zzz-aucune-adresse");
    await expect(page.getByTestId("place-card")).toHaveCount(0);
    await rail.getByTestId("places-search").fill("");
    await expect(page.getByTestId("place-card")).toHaveCount(avant);
  });

  test("une fiche ouverte laisse les filtres au-dessus de la liste, sans troisième colonne", async ({ page }) => {
    await login(page, "client@vito.test");
    await page.goto("/fr/restos?onglet=tous");
    await page.getByTestId("place-card").first().getByRole("link").first().click();
    await expect(page.getByTestId("places-detail")).toBeVisible();
    await expect(page.getByTestId("places-filtres")).toHaveCount(0);
    await expect(page.getByTestId("places-search")).toBeVisible();
  });
});
