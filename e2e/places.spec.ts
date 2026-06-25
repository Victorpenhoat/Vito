import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
  await page.goto("/fr/restos");
}

// Seed: client@vito.test a 1 resto "Le Bistrot Démo" (is_favorite=true, statut='a_faire')
// → apparaît dans l'onglet Favoris (filtre is_favorite) ET dans À tester (filtre statut=a_faire)

test("places-tabs est visible après login", async ({ page }) => {
  await login(page);
  await expect(page.getByTestId("places-tabs")).toBeVisible();
});

test("onglet Tous est actif par défaut et contient le resto seedé", async ({ page }) => {
  await login(page);
  // L'onglet Tous est sélectionné par défaut (Le Carnet)
  await expect(page.getByTestId("tab-tous")).toHaveAttribute("aria-selected", "true");
  // Le Bistrot Démo (seul item de la liste) apparaît sous l'onglet Tous
  await expect(page.getByTestId("place-card")).toHaveCount(1);
  await expect(page.getByTestId("place-card").first()).toContainText("Bistrot");
});

test("basculer sur l'onglet À tester affiche la liste correcte", async ({ page }) => {
  await login(page);
  // Basculer vers l'onglet À tester
  await page.getByTestId("tab-a-tester").click();
  await expect(page.getByTestId("tab-a-tester")).toHaveAttribute("aria-selected", "true");
  // Le Bistrot Démo a statut='a_faire' → il apparaît aussi ici
  await expect(page.getByTestId("place-card")).toHaveCount(1);
  await expect(page.getByTestId("place-card").first()).toContainText("Bistrot");
});

test("la recherche interne filtre les place-cards (terme présent)", async ({ page }) => {
  await login(page);
  // Terme présent dans le nom "Le Bistrot Démo"
  await page.getByTestId("places-search").fill("bistrot");
  await expect(page.getByTestId("place-card")).toHaveCount(1);
});

test("la recherche interne filtre les place-cards (terme absent → liste vide)", async ({ page }) => {
  await login(page);
  // Terme absent → aucune place-card
  await page.getByTestId("places-search").fill("xyzabsent999");
  await expect(page.getByTestId("place-card")).toHaveCount(0);
});

test("la recherche fonctionne aussi dans l'onglet À tester", async ({ page }) => {
  await login(page);
  await page.getByTestId("tab-a-tester").click();
  // Terme présent
  await page.getByTestId("places-search").fill("demo");
  await expect(page.getByTestId("place-card")).toHaveCount(1);
  // Terme absent
  await page.getByTestId("places-search").fill("xyzabsent999");
  await expect(page.getByTestId("place-card")).toHaveCount(0);
});
