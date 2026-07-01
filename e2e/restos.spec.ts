import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
  await page.goto("/fr/restos");
}

test("ajouter un resto via recherche, puis consulter sa fiche et ajouter un avis", async ({ page }) => {
  await login(page);

  // Ouvrir l'onglet Recherche (la barre de recherche externe n'existe que là)
  await page.getByTestId("tab-recherche").click();

  // Recherche (provider mock) + ajout
  await page.getByTestId("add-resto-search").fill("bistrot");
  await page.getByTestId("search-submit").click();
  await expect(page.getByTestId("search-result").first()).toBeVisible();
  await page.getByTestId("search-result").first().getByRole("button").click();

  // Le Bistrot du Coin est ajouté sans is_favorite + statut='a_faire' → il apparaît dans Recommandés
  await page.getByTestId("tab-recommandes").click();
  await expect(page.getByTestId("place-card").filter({ hasText: "Bistrot" }).first()).toBeVisible();

  // Ouvrir la fiche de "Le Bistrot du Coin" (ajouté via mock — a un UUID v4 valide pour la RPC avis)
  await page.getByTestId("place-card").filter({ hasText: "Le Bistrot du Coin" }).first().getByRole("link").click();
  await expect(page.getByTestId("avis-form")).toBeVisible();

  await page.getByTestId("avis-form").locator("textarea").fill("Très bonne adresse, revenir le samedi");
  await page.getByTestId("avis-form").getByRole("button").click();
  await expect(page.getByText("Très bonne adresse")).toBeVisible();
});

test("basculer un favori", async ({ page }) => {
  await login(page);
  // On atteint le Bistrot Démo via Recommandés : il y reste favori ou non (statut a_faire),
  // alors que l'onglet Favoris se vide si une tentative précédente a laissé le favori retiré.
  await page.getByTestId("tab-recommandes").click();
  await page.getByTestId("place-card").filter({ hasText: "Le Bistrot Démo" }).first().getByRole("link").click();
  const toggle = page.getByTestId("favorite-toggle");
  await expect(toggle).toBeVisible();
  const wasFavorite = ((await toggle.textContent()) ?? "").includes("★");
  await toggle.click();
  // L'action ne re-rend pas la fiche en place (revalidatePath("/restos") ne couvre pas /restos/[id]) :
  // on attend le POST de l'action puis on recharge pour asserter l'état persisté en base.
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(toggle).toContainText(wasFavorite ? "☆" : "★");
  // RESTAURER l'état favori du seed : c'est l'unique favori de client@vito.test, et
  // vins.spec (exécuté après) ouvre la première place-card de l'onglet Favoris.
  if (!((await toggle.textContent()) ?? "").includes("★")) {
    await toggle.click();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(toggle).toContainText("★");
  }
});

test("appliquer un tag d'ambiance sur un resto et vérifier la persistance", async ({ page }) => {
  await login(page);

  // "Le Bistrot du Coin" a été ajouté par le 1er test (état DB partagé, workers:1, statut a_faire)
  // → on l'atteint via l'onglet Recommandés (la recherche externe dédoublonne les lieux déjà possédés)
  await page.getByTestId("tab-recommandes").click();
  await expect(page.getByTestId("place-card").filter({ hasText: "Le Bistrot du Coin" }).first()).toBeVisible();

  // Ouvrir la fiche de "Le Bistrot du Coin" (UUID v4 valide généré par la base)
  await page.getByTestId("place-card").filter({ hasText: "Le Bistrot du Coin" }).first().getByRole("link").click();

  // Le tag-picker doit être visible (l'item est dans la liste)
  const tagPicker = page.getByTestId("tag-picker");
  await expect(tagPicker).toBeVisible();

  // Récupérer le premier tag disponible
  const firstTagLabel = tagPicker.locator("label").first();
  const firstCheckbox = firstTagLabel.locator("input[type='checkbox']");

  // Décocher si déjà coché (idempotence : on part d'un état décoché, puis on coche)
  const isChecked = await firstCheckbox.isChecked();
  if (isChecked) {
    await firstCheckbox.uncheck();
    await tagPicker.getByRole("button").click();
    // Signal serveur déterministe : la sauvegarde est confirmée par le composant.
    await expect(page.getByTestId("tags-saved")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("tag-picker")).toBeVisible();
  }

  // Cocher le premier tag et soumettre
  await page.getByTestId("tag-picker").locator("label").first().locator("input[type='checkbox']").check();
  await page.getByTestId("tag-picker").getByRole("button").click();
  // Attendre la confirmation serveur (commit garanti) avant de recharger.
  await expect(page.getByTestId("tags-saved")).toBeVisible();

  // Recharger la page pour vérifier la persistance
  await page.reload();

  // Le tag doit toujours être coché
  const tagPickerReloaded = page.getByTestId("tag-picker");
  await expect(tagPickerReloaded).toBeVisible();
  const firstCheckboxReloaded = tagPickerReloaded.locator("label").first().locator("input[type='checkbox']");
  await expect(firstCheckboxReloaded).toBeChecked();
});

test("photo proxy sur la fiche d'un resto ajouté via mock (Le Bistrot du Coin)", async ({ page }) => {
  await login(page);

  // "Le Bistrot du Coin" (avec photoRefs dans le mock) a été ajouté par le 1er test (état DB partagé)
  // → on l'atteint via l'onglet Recommandés (la recherche externe dédoublonne les lieux déjà possédés)
  await page.getByTestId("tab-recommandes").click();
  await expect(page.getByTestId("place-card").filter({ hasText: "Le Bistrot du Coin" }).first()).toBeVisible();

  // Ouvrir sa fiche
  await page.getByTestId("place-card").filter({ hasText: "Le Bistrot du Coin" }).first().getByRole("link").click();

  // La photo proxy doit être visible (FicheResto récupère photoRefs via getPlacesProvider().details())
  const photo = page.getByTestId("resto-photo").first();
  await expect(photo).toBeVisible();
  // L'URL doit passer par le proxy same-origin (jamais une URL externe ou clé exposée).
  // next/image sert l'image via /_next/image?url=<encoded-proxy-path>.
  const src = await photo.getAttribute("src");
  expect(src).toMatch(/api%2Fplaces%2Fphoto|\/api\/places\/photo/);
});
