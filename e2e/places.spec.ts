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

test("onglet Recherche affiche le champ de recherche (Découverte)", async ({ page }) => {
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

test("a11y : le panneau d'onglet expose role=tabpanel lié à l'onglet actif", async ({ page }) => {
  await login(page);
  const panel = page.getByTestId("places-panel");
  await expect(panel).toHaveAttribute("role", "tabpanel");
  await expect(panel).toHaveAttribute("aria-labelledby", "tab-favoris");
});

test("archivage : vue Archivés + désarchiver inline + ré-archiver depuis la fiche", async ({ page }) => {
  await login(page);
  const ARCHIVED_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  // Idempotence : ce test désarchive l'unique item archivé du seed puis le ré-archive.
  // Si une tentative précédente a échoué entre les deux, l'item reste désarchivé — et
  // comme les retries Playwright ne réinitialisent pas la base, la tentative suivante
  // échouerait à L102 (onglet Archivés masqué car archived.length === 0). On restaure
  // donc l'état « archivé » au départ pour que le test se répare au retry.
  await page.goto(`/fr/restos/${ARCHIVED_ID}`);
  const toggle = page.getByTestId("archive-toggle");
  await expect(toggle).toBeVisible();
  if (!((await toggle.textContent()) ?? "").includes("Désarchiver")) {
    await toggle.click();
    await page.waitForLoadState("networkidle");
  }
  await page.goto("/fr/restos");

  const archived = () => page.getByTestId("archived-item").filter({ hasText: "Le Resto Archivé Démo" });
  // Le lien Archivés est visible (≥1 archivé seedé)
  await expect(page.getByTestId("tab-archives")).toBeVisible();
  await page.getByTestId("tab-archives").click();
  await expect(archived()).toBeVisible();
  // Désarchiver inline → quitte la liste Archivés
  await archived().getByTestId("archive-unarchive").click();
  await expect(archived()).toHaveCount(0);
  // RESTAURER : ouvrir la fiche et ré-archiver
  await page.goto(`/fr/restos/${ARCHIVED_ID}`);
  await page.getByTestId("archive-toggle").click();
  await page.waitForLoadState("networkidle");
  // De retour sur la liste, il est de nouveau archivé
  await page.goto("/fr/restos");
  await page.getByTestId("tab-archives").click();
  await expect(archived()).toBeVisible();
});
