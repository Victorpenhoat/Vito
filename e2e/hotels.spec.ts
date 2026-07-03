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
  // Idempotent (même recette que restos, cf. #72) : si une tentative ou un run précédent a
  // déjà ajouté l'hôtel, la recherche le dédoublonne (badge « Ajouté » sans bouton d'ajout,
  // markOwned) — .first().getByRole("button") ferait échouer les retries en dur.
  await page.getByTestId("add-hotel-search").fill("hôtel");
  await page.getByTestId("search-submit").click();
  const voyageurs = page.getByTestId("search-result").filter({ hasText: "Hôtel des Voyageurs" }).first();
  await expect(voyageurs).toBeVisible();
  if ((await voyageurs.getByTestId("result-added").count()) === 0) {
    await voyageurs.getByRole("button").click();
  }
  // Le badge « Ajouté » n'apparaît qu'après résolution de l'action serveur (commit garanti)
  await expect(voyageurs.getByTestId("result-added")).toBeVisible({ timeout: 15_000 });
  // L'hôtel ajouté est non-favori + statut='a_faire' → il apparaît dans Recommandés
  await page.getByTestId("tab-recommandes").click();
  await expect(page.getByTestId("place-card").filter({ hasText: "Hôtel des Voyageurs" }).first()).toBeVisible({ timeout: 15_000 });
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
  // ≥ 2 hôtels recommandés (Hôtel Démo [spa] + Hôtel Démo 2 [sans tag] ; d'autres
  // tests du fichier peuvent en ajouter en base partagée → on capture le total).
  const total = await page.getByTestId("place-card").count();
  expect(total).toBeGreaterThanOrEqual(2);
  // filtrer par Spa → seul l'Hôtel Démo est taggé spa
  await page.getByTestId("list-tag-spa").click();
  await expect(page.getByTestId("place-card")).toHaveCount(1);
  // retour Tous → on retrouve le total initial
  await page.getByTestId("list-tag-tous").click();
  await expect(page.getByTestId("place-card")).toHaveCount(total);
});
