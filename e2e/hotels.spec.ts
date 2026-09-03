import { test, expect, type Page } from "@playwright/test";
import { expectVisibleWithReload } from "./helpers";

// Hôtels v2 : l'onglet est rendu par la brique générique CategoryTabs
// (sous-onglets ?onglet= URL-driven — navigation par URL, jamais par clic
// d'onglet : le clic peut asserter contre le panneau périmé, cf. Resto v2).

async function login(page: Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

test("l'onglet Hôtels v2 montre l'hôtel à tester seedé", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels?onglet=a_tester");
  await expect(page.getByTestId("hotels-tabs")).toBeVisible();
  await expect(page.getByTestId("place-card").filter({ hasText: "Hôtel Démo" }).first()).toBeVisible();
});

test("l'hôtel n'apparaît PAS dans Restos (getPlaces resto exclut les hôtels)", async ({ page }) => {
  await login(page);
  await page.goto("/fr/restos?onglet=tous");
  await expect(page.getByTestId("restos-tabs")).toBeVisible();
  await expect(page.getByTestId("places-panel")).toBeVisible();
  await expect(page.getByTestId("place-card").filter({ hasText: "Hôtel Démo" })).toHaveCount(0);
});

test("Séjours : le séjour seedé (Hôtel Démo 2) est listé avec sa note", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels?onglet=sejours");
  const row = page.getByTestId("place-card").filter({ hasText: "Hôtel Démo 2" }).first();
  await expectVisibleWithReload(page, row);
  // RowExtras : dernier séjour (date + note /10) + « Passer en favori »
  await expect(page.getByText("séjour le 2026-09-12")).toBeVisible();
  await expect(page.getByTestId("passer-favori").first()).toBeVisible();
});

test("ajouter un hôtel via la recherche externe (statut du sous-onglet)", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels?onglet=a_tester");
  await page.getByTestId("trouver-hotel").click();
  // Idempotent (recette #72/Resto v2) : si un run précédent l'a déjà ajouté, il
  // remonte en « Déjà dans Vito » avec un chip statut (result-added) sans bouton.
  await page.getByTestId("add-hotel-search").fill("hôtel");
  await page.getByTestId("search-submit").click();
  const voyageurs = page.getByTestId("search-result").filter({ hasText: "Hôtel des Voyageurs" }).first();
  await expect(voyageurs).toBeVisible();
  if ((await voyageurs.getByTestId("result-added").count()) === 0) {
    // 2 boutons par ligne externe (+ statut / ▾) → .first() = ajout au statut du sous-onglet
    await voyageurs.getByRole("button").first().click();
  }
  await expect(voyageurs.getByTestId("result-added")).toBeVisible({ timeout: 15_000 });
  // Ajouté depuis « À tester » → il apparaît dans ce sous-onglet
  await page.goto("/fr/hotels?onglet=a_tester");
  await expectVisibleWithReload(page, page.getByTestId("place-card").filter({ hasText: "Hôtel des Voyageurs" }).first());
});

test("recherche externe hôtel : chips « Explorer par envie »", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels");
  await page.getByTestId("trouver-hotel").click();
  await expect(page.getByTestId("envies")).toBeVisible();
  await expect(page.getByTestId("envie-envieSpa")).toBeVisible();
});

test("liste hôtel : filtre par tag (Spa)", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels?onglet=a_tester");
  await expect(page.getByTestId("list-tag-filter")).toBeVisible();
  // ≥ 1 hôtel à tester (Hôtel Démo [spa] ; le test d'ajout peut en ajouter en
  // base partagée → on capture le total plutôt qu'un compte absolu).
  const total = await page.getByTestId("place-card").count();
  expect(total).toBeGreaterThanOrEqual(1);
  await page.getByTestId("list-tag-spa").click();
  await expect(page.getByTestId("place-card")).toHaveCount(1);
  await page.getByTestId("list-tag-tous").click();
  await expect(page.getByTestId("place-card")).toHaveCount(total);
});

test("carte hôtels : légende par statut et compteur", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels?onglet=carte");
  await expect(page.getByTestId("map-legend")).toBeVisible();
  await expect(page.getByTestId("map-count")).toBeVisible();
});
