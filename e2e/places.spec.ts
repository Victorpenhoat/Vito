import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
  await page.goto("/fr/restos");
}

// Seed : client@vito.test a « Le Bistrot Démo » (is_favorite=true, statut='a_faire',
// origine reco 'Camille' — backfill 00030, rating=4.6) → statut v2 « Favori », et
// « Le Comptoir Démo » (a_faire, non favori) → « À tester ». Restos v2 : 5 sous-onglets.

test("les 5 sous-onglets sont visibles, Favoris actif par défaut", async ({ page }) => {
  await login(page);
  await expect(page.getByTestId("restos-tabs")).toBeVisible();
  for (const id of ["tab-favoris", "tab-a-tester", "tab-testes", "tab-tous", "tab-carte"]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await expect(page.getByTestId("tab-favoris")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("place-card")).toHaveCount(1);
});

test("Favoris : note + « Conseillé par » + toggle 3 vues (Vignettes puis Carte)", async ({ page }) => {
  await login(page);
  await expect(page.getByTestId("place-note").first()).toContainText("4,6");
  await expect(page.getByTestId("place-reco")).toContainText("Camille");
  await expect(page.getByTestId("view-liste")).toBeVisible();
  await page.getByTestId("view-vignettes").click();
  await expect(page.getByTestId("place-card-vignette")).toHaveCount(1);
  await page.getByTestId("view-carte").click();
  await expect(page.getByTestId("places-map")).toBeVisible();
});

test("À tester : le Comptoir y est, avec le filtre d'origine", async ({ page }) => {
  await login(page);
  await page.getByTestId("tab-a-tester").click();
  await expect(page.getByTestId("place-card").filter({ hasText: "Le Comptoir Démo" })).toBeVisible();
  // le Bistrot (favori) ne doit PAS apparaître : partition exclusive v2
  await expect(page.getByTestId("place-card").filter({ hasText: "Le Bistrot Démo" })).toHaveCount(0);
  for (const id of ["origine-toutes", "origine-reco", "origine-trouve"]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  // le Comptoir n'a pas d'origine → le filtre « Recommandations » le masque
  await page.getByTestId("origine-reco").click();
  await expect(page.getByTestId("place-card")).toHaveCount(0);
});

test("Tous : filtres de statut cumulables + compteur", async ({ page }) => {
  await login(page);
  await page.getByTestId("tab-tous").click();
  await expect(page.getByTestId("place-card")).toHaveCount(2);
  await expect(page.getByTestId("tous-count")).toContainText("2");
  await page.getByTestId("statut-favori").click();
  await expect(page.getByTestId("place-card")).toHaveCount(1);
  await expect(page.getByTestId("tous-count")).toContainText("1");
  await page.getByTestId("statut-favori").click();
  await expect(page.getByTestId("place-card")).toHaveCount(2);
});

test("filtre local d'un sous-onglet filtre les place-cards", async ({ page }) => {
  await login(page);
  await page.getByTestId("places-search").fill("bistrot");
  await expect(page.getByTestId("place-card")).toHaveCount(1);
  await page.getByTestId("places-search").fill("xyzabsent999");
  await expect(page.getByTestId("place-card")).toHaveCount(0);
  // état « aucun résultat » avec proposition de recherche externe
  await expect(page.getByTestId("place-empty-state")).toBeVisible();
});

test("onglet Carte : carte combinée — légende, filtre tag, comptage", async ({ page }) => {
  await login(page);
  await page.getByTestId("tab-carte").click();
  await expect(page.getByTestId("places-map")).toBeVisible();
  await expect(page.getByTestId("map-legend")).toBeVisible();
  await expect(page.getByTestId("map-tag-filter")).toBeVisible();
  // 2 adresses resto (Bistrot favori + Comptoir à tester)
  await expect(page.getByTestId("map-count")).toContainText("2");
  // filtrer par « Terrasse » → seul le Bistrot
  await page.getByTestId("map-tag-terrasse").click();
  await expect(page.getByTestId("map-count")).toContainText("1");
  // retour « Tous »
  await page.getByTestId("map-tag-tous").click();
  await expect(page.getByTestId("map-count")).toContainText("2");
});

test("« Trouver un restaurant » : découverte (envies, submit, récentes) accessible partout", async ({ page }) => {
  await login(page);
  await page.getByTestId("trouver-restaurant").click();
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

test("a11y : le panneau expose role=tabpanel lié au sous-onglet actif", async ({ page }) => {
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
  // échouerait (bouton Archivés masqué car archived.length === 0). On restaure
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
  // Désarchiver inline → quitte la liste Archivés. Sous charge CI le refresh RSC
  // post-action peut revenir VIDE (race routeur client) : reload → rendu frais.
  await archived().getByTestId("archive-unarchive").click();
  await page.waitForLoadState("networkidle");
  try {
    await expect(archived()).toHaveCount(0);
  } catch {
    await page.reload();
    // L'item du seed est l'unique archivé : désarchivé, le bouton Archivés n'est plus rendu
    await expect(page.getByTestId("tab-archives")).toHaveCount(0);
  }
  // RESTAURER : ouvrir la fiche et ré-archiver (attendre le POST — signal déterministe).
  await page.goto(`/fr/restos/${ARCHIVED_ID}`);
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/fr/restos/")),
    page.getByTestId("archive-toggle").click(),
  ]);
  // De retour sur la liste, il est de nouveau archivé
  await page.goto("/fr/restos");
  await page.getByTestId("tab-archives").click();
  await expect(archived()).toBeVisible();
});