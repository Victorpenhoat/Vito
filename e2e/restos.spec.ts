import { test, expect } from "@playwright/test";
import { expectVisibleWithReload } from "./helpers";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
  await page.goto("/fr/restos");
}

test("ajouter un resto via « Trouver », puis marquer une visite depuis sa fiche", async ({ page }) => {
  await login(page);

  // Recherche externe (v2 : accessible partout via le bouton « Trouver »)
  await page.getByTestId("trouver-restaurant").click();

  // Recherche (provider mock) + ajout — idempotent : si une tentative précédente a déjà ajouté
  // « Le Bistrot du Coin », la recherche le dédoublonne (badge « Ajouté », markOwned).
  await page.getByTestId("add-resto-search").fill("bistrot");
  await page.getByTestId("search-submit").click();
  const coin = page.getByTestId("search-result").filter({ hasText: "Le Bistrot du Coin" }).first();
  await expect(coin).toBeVisible();
  if ((await coin.getByTestId("result-added").count()) === 0) {
    await coin.getByRole("button").click();
  }
  // Le badge « Ajouté » n'apparaît qu'après résolution de l'action serveur (commit garanti)
  await expect(coin.getByTestId("result-added")).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");

  // On l'atteint via « Tous » : idempotent quel que soit son statut v2 (un run
  // précédent l'a peut-être déjà passé « Testé » via la visite ci-dessous).
  await page.getByTestId("tab-tous").click();
  await expectVisibleWithReload(page, page.getByTestId("place-card").filter({ hasText: "Le Bistrot du Coin" }).first());

  // Ouvrir la fiche et marquer une visite (v2 : remplace l'avis côté resto)
  await page.getByTestId("place-card").filter({ hasText: "Le Bistrot du Coin" }).first().getByRole("link").click();
  await expect(page.getByTestId("visite-cta")).toBeVisible();
  await page.getByTestId("visite-cta").click();
  await expect(page.getByTestId("visite-form")).toBeVisible();

  // Commentaire unique par tentative (base jamais réinitialisée entre retries)
  const commentaire = `Très bonne adresse ${Date.now()}`;
  await page.getByTestId("visite-form").locator("textarea").fill(commentaire);
  await page.getByTestId("visite-form").getByRole("button", { name: "Enregistrer la visite" }).click();
  // La visite apparaît dans « Mes visites » (reload-guard : race RSC documentée)
  await expectVisibleWithReload(page, page.getByTestId("visite-row").filter({ hasText: commentaire }).first());
});

test("changer le statut depuis la fiche (chip v2) et le restaurer", async ({ page }) => {
  await login(page);
  // Le Bistrot Démo est l'unique favori du seed → première card de l'onglet Favoris
  await page.getByTestId("place-card").filter({ hasText: "Le Bistrot Démo" }).first().getByRole("link").click();
  const chip = page.getByTestId("statut-chip");
  await expect(chip).toBeVisible();
  await expect(chip).toContainText("Favori");

  // Favori → À tester. On attend la RÉPONSE du POST de l'action (signal de commit
  // déterministe), puis reload pour asserter l'état persisté (pattern historique).
  const actionDone = () => page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/fr/restos/"));
  await chip.click();
  await Promise.all([actionDone(), page.getByTestId("statut-option-a_tester").click()]);
  await page.reload();
  await expect(page.getByTestId("statut-chip")).toContainText("À tester");

  // RESTAURER le favori du seed (vins.spec ouvre la 1re card de l'onglet Favoris)
  await page.getByTestId("statut-chip").click();
  await Promise.all([actionDone(), page.getByTestId("statut-option-favori").click()]);
  await page.reload();
  await expect(page.getByTestId("statut-chip")).toContainText("Favori");
});

test("appliquer un tag d'ambiance sur un resto et vérifier la persistance", async ({ page }) => {
  await login(page);

  // "Le Bistrot du Coin" a été ajouté PUIS visité par le 1er test (état DB partagé,
  // workers:1) → statut v2 « Testé »
  await page.getByTestId("tab-testes").click();
  await expect(page.getByTestId("place-card").filter({ hasText: "Le Bistrot du Coin" }).first()).toBeVisible();
  await page.getByTestId("place-card").filter({ hasText: "Le Bistrot du Coin" }).first().getByRole("link").click();

  // Le tag-picker doit être visible (l'item est dans la liste)
  const tagPicker = page.getByTestId("tag-picker");
  await expect(tagPicker).toBeVisible();

  const firstTagLabel = tagPicker.locator("label").first();
  const firstCheckbox = firstTagLabel.locator("input[type='checkbox']");

  // Décocher si déjà coché (idempotence : on part d'un état décoché, puis on coche)
  const isChecked = await firstCheckbox.isChecked();
  if (isChecked) {
    await firstCheckbox.uncheck();
    await tagPicker.getByRole("button").click();
    await expect(page.getByTestId("tags-saved")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("tag-picker")).toBeVisible();
  }

  await page.getByTestId("tag-picker").locator("label").first().locator("input[type='checkbox']").check();
  await page.getByTestId("tag-picker").getByRole("button").click();
  await expect(page.getByTestId("tags-saved")).toBeVisible();

  await page.reload();
  const tagPickerReloaded = page.getByTestId("tag-picker");
  await expect(tagPickerReloaded).toBeVisible();
  const firstCheckboxReloaded = tagPickerReloaded.locator("label").first().locator("input[type='checkbox']");
  await expect(firstCheckboxReloaded).toBeChecked();
});

test("photo proxy sur la fiche d'un resto ajouté via mock (Le Bistrot du Coin)", async ({ page }) => {
  await login(page);

  // visité par le 1er test → sous-onglet « Testés »
  await page.getByTestId("tab-testes").click();
  await expect(page.getByTestId("place-card").filter({ hasText: "Le Bistrot du Coin" }).first()).toBeVisible();
  await page.getByTestId("place-card").filter({ hasText: "Le Bistrot du Coin" }).first().getByRole("link").click();

  // La photo proxy doit être visible (FicheResto récupère photoRefs via getPlacesProvider().details())
  const photo = page.getByTestId("resto-photo").first();
  await expect(photo).toBeVisible();
  const src = await photo.getAttribute("src");
  expect(src).toMatch(/api%2Fplaces%2Fphoto|\/api\/places\/photo/);
});