import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("ajouter un resto via recherche, puis consulter sa fiche et ajouter un avis", async ({ page }) => {
  await login(page);

  // Recherche (provider mock) + ajout
  await page.getByTestId("add-resto-search").fill("bistrot");
  await expect(page.getByTestId("search-result").first()).toBeVisible();
  await page.getByTestId("search-result").first().getByRole("button").click();

  // Le resto apparaît dans la liste (Le Bistrot Démo déjà là ou Le Bistrot du Coin ajouté)
  await expect(page.getByTestId("resto-card").filter({ hasText: "Bistrot" }).first()).toBeVisible();

  // Ouvrir la fiche de "Le Bistrot du Coin" (ajouté via mock — a un UUID v4 valide pour la RPC avis)
  await page.getByTestId("resto-card").filter({ hasText: "Le Bistrot du Coin" }).first().getByRole("link").click();
  await expect(page.getByTestId("avis-form")).toBeVisible();

  await page.getByTestId("avis-form").locator("textarea").fill("Très bonne adresse, revenir le samedi");
  await page.getByTestId("avis-form").getByRole("button").click();
  await expect(page.getByText("Très bonne adresse")).toBeVisible();
});

test("basculer un favori", async ({ page }) => {
  await login(page);
  await page.getByTestId("resto-card").first().getByRole("link").click();
  await page.getByTestId("favorite-toggle").click();
  await expect(page.getByTestId("favorite-toggle")).toContainText("Favori");
});

test("appliquer un tag d'ambiance sur un resto et vérifier la persistance", async ({ page }) => {
  await login(page);

  // S'assurer que "Le Bistrot du Coin" est dans la liste (idempotent grâce à l'upsert)
  await page.getByTestId("add-resto-search").fill("bistrot");
  await expect(page.getByTestId("search-result").first()).toBeVisible();
  await page.getByTestId("search-result").first().getByRole("button").click();
  await expect(page.getByTestId("resto-card").filter({ hasText: "Le Bistrot du Coin" }).first()).toBeVisible();

  // Ouvrir la fiche de "Le Bistrot du Coin" (UUID v4 valide généré par la base)
  await page.getByTestId("resto-card").filter({ hasText: "Le Bistrot du Coin" }).first().getByRole("link").click();

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
    // Attendre que le serveur confirme la mise à jour
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.getByTestId("tag-picker")).toBeVisible();
  }

  // Cocher le premier tag et soumettre
  await page.getByTestId("tag-picker").locator("label").first().locator("input[type='checkbox']").check();
  await page.getByTestId("tag-picker").getByRole("button").click();
  // Attendre la réponse du serveur avant de recharger
  await page.waitForLoadState("networkidle");

  // Recharger la page pour vérifier la persistance
  await page.reload();

  // Le tag doit toujours être coché
  const tagPickerReloaded = page.getByTestId("tag-picker");
  await expect(tagPickerReloaded).toBeVisible();
  const firstCheckboxReloaded = tagPickerReloaded.locator("label").first().locator("input[type='checkbox']");
  await expect(firstCheckboxReloaded).toBeChecked();
});
