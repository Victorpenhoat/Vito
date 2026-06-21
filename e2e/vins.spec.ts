import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("capturer un vin depuis une fiche resto, le retrouver dans Mes vins et filtrer", async ({ page }) => {
  await login(page);

  // Ouvre la fiche du resto démo (déjà dans la liste du client)
  await page.getByTestId("resto-card").first().getByRole("link").click();
  await expect(page).toHaveURL(/\/fr\/restos\//);

  // Le formulaire de dégustation est visible
  const form = page.getByTestId("degustation-form");
  await expect(form).toBeVisible();

  // Utilise un nom unique pour éviter les collisions entre runs
  const vinNom = `Vin E2E ${Date.now()}`;

  // Remplit le formulaire de dégustation
  await form.locator('input[name="nom"]').fill(vinNom);
  await form.locator('select[name="couleur"]').selectOption("blanc");
  await form.locator('input[name="note"]').fill("4");

  // Soumet le formulaire (le bouton submit de la form)
  await form.getByRole("button").click();

  // Attend que l'action server se termine : le bouton redevient actif (pending=false)
  await expect(form.getByRole("button")).toBeEnabled({ timeout: 15_000 });

  // Va dans Mes vins
  await page.goto("/fr/vins");

  // Le vin apparaît bien dans la liste
  await expect(
    page.getByTestId("vin-row").filter({ hasText: vinNom })
  ).toBeVisible();

  // Filtre par couleur blanc -> toujours visible
  await page.getByTestId("vins-filters").locator("select").first().selectOption("blanc");
  await expect(
    page.getByTestId("vin-row").filter({ hasText: vinNom })
  ).toBeVisible();

  // Ouvre le détail du vin (click sur le lien dans le vin-row)
  await page.getByTestId("vin-row").filter({ hasText: vinNom }).getByRole("link").click();
  await expect(page).toHaveURL(/\/fr\/vins\//);

  // Le bouton d'achat est visible
  await expect(page.getByTestId("buy-button")).toBeVisible();
});
