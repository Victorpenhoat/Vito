import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
  await page.goto("/fr/restos");
}

// Seed: client@vito.test a 1 resto "Le Bistrot Démo" (is_favorite=true, statut='a_faire',
// reco_source='Camille', rating=4.6) → présent dans Favoris ET Recommandés.

test("les 4 onglets sont visibles, Favoris actif par défaut", async ({ page }) => {
  await login(page);
  await expect(page.getByTestId("places-tabs")).toBeVisible();
  for (const id of ["tab-favoris", "tab-recommandes", "tab-carte", "tab-recherche"]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await expect(page.getByTestId("tab-favoris")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("place-card")).toHaveCount(1);
});

test("Favoris : note affichée + toggle 3 vues (Vignettes puis Carte)", async ({ page }) => {
  await login(page);
  await expect(page.getByTestId("place-note").first()).toContainText("4,6");
  await expect(page.getByTestId("view-liste")).toBeVisible();
  await expect(page.getByTestId("view-vignettes")).toBeVisible();
  await page.getByTestId("view-vignettes").click();
  await expect(page.getByTestId("place-card-vignette")).toHaveCount(1);
  await page.getByTestId("view-carte").click();
  await expect(page.getByTestId("places-map")).toBeVisible();
});

test("Recommandés : pas de toggle, « Conseillé par X » visible", async ({ page }) => {
  await login(page);
  await page.getByTestId("tab-recommandes").click();
  await expect(page.getByTestId("view-vignettes")).toHaveCount(0);
  await expect(page.getByTestId("place-reco")).toContainText("Camille");
});

test("filtre local d'un onglet filtre les place-cards", async ({ page }) => {
  await login(page);
  await page.getByTestId("places-search").fill("bistrot");
  await expect(page.getByTestId("place-card")).toHaveCount(1);
  await page.getByTestId("places-search").fill("xyzabsent999");
  await expect(page.getByTestId("place-card")).toHaveCount(0);
});

test("onglet Recherche affiche le PlaceSearch", async ({ page }) => {
  await login(page);
  await page.getByTestId("tab-recherche").click();
  await expect(page.getByTestId("add-resto-search")).toBeVisible();
});

test("onglet Carte : carte combinée — légende, filtre tag, comptage", async ({ page }) => {
  await login(page);
  await page.getByTestId("tab-carte").click();
  await expect(page.getByTestId("places-map")).toBeVisible();
  await expect(page.getByTestId("map-legend")).toBeVisible();
  await expect(page.getByTestId("map-tag-filter")).toBeVisible();
  // 2 adresses resto (Bistrot favori + Comptoir recommandé)
  await expect(page.getByTestId("map-count")).toContainText("2");
  // filtrer par « Terrasse » → seul le Bistrot
  await page.getByTestId("map-tag-terrasse").click();
  await expect(page.getByTestId("map-count")).toContainText("1");
  // retour « Tous »
  await page.getByTestId("map-tag-tous").click();
  await expect(page.getByTestId("map-count")).toContainText("2");
});

test("onglet Recherche : découverte (envies, submit, récentes)", async ({ page }) => {
  await login(page);
  await page.getByTestId("tab-recherche").click();
  // état initial : chips d'envie rendues
  await expect(page.getByTestId("envies")).toBeVisible();
  await expect(page.getByTestId("envie-envieItalien")).toBeVisible();
  // submit "bistrot" → résultats
  await page.getByTestId("add-resto-search").fill("bistrot");
  await page.getByTestId("search-submit").click();
  await expect(page.getByTestId("search-result").first()).toBeVisible();
  // revenir à la découverte → la recherche récente est enregistrée
  await page.getByTestId("search-clear").click();
  await expect(page.getByTestId("recents")).toContainText("bistrot");
  // re-cliquer la récente relance la recherche
  await page.getByTestId("recent-item").first().click();
  await expect(page.getByTestId("search-result").first()).toBeVisible();
});
