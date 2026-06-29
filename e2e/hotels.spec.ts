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
  // Hôtel Démo est is_favorite=false + statut='a_faire' → visible dans Recommandés
  await page.getByTestId("tab-recommandes").click();
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
  // La barre de recherche externe n'existe que dans l'onglet Recherche
  await page.getByTestId("tab-recherche").click();
  await page.getByTestId("add-hotel-search").fill("hôtel");
  await page.getByTestId("search-submit").click();
  await expect(page.getByTestId("search-result").first()).toBeVisible();
  await page.getByTestId("search-result").first().getByRole("button").click();
  // L'hôtel ajouté est non-favori + statut='a_faire' → il apparaît dans Recommandés
  await page.getByTestId("tab-recommandes").click();
  await expect(page.getByTestId("place-card").first()).toBeVisible();
});

test("onglet Recherche hôtel : chips « Explorer par envie »", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels");
  await page.getByTestId("tab-recherche").click();
  await expect(page.getByTestId("envies")).toBeVisible();
  await expect(page.getByTestId("envie-envieSpa")).toBeVisible();
});

test("liste hôtel : filtre par ambiance (Spa)", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels");
  await page.getByTestId("tab-recommandes").click();
  await expect(page.getByTestId("list-tag-filter")).toBeVisible();
  // 2 hôtels recommandés seedés (Hôtel Démo [spa] + Hôtel Démo 2 [sans tag])
  await expect(page.getByTestId("place-card")).toHaveCount(2);
  // filtrer par Spa → seul l'Hôtel Démo
  await page.getByTestId("list-tag-spa").click();
  await expect(page.getByTestId("place-card")).toHaveCount(1);
  // retour Tous → 2
  await page.getByTestId("list-tag-tous").click();
  await expect(page.getByTestId("place-card")).toHaveCount(2);
});
