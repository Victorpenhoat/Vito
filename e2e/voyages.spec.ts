import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("créer un voyage, ajouter une réservation, partager avec l'agence", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/voyages");

  // Titre unique pour être re-run-safe
  const titre = `Voyage E2E Lisbonne ${Date.now()}`;
  await page.getByTestId("voyage-form").locator('input[name="titre"]').fill(titre);
  await page.getByTestId("voyage-form").getByRole("button").click();

  // Le voyage apparaît dans la liste
  await expect(page.getByTestId("voyage-card").filter({ hasText: "Lisbonne" }).first()).toBeVisible();

  // Ouvrir le voyage (cliquer sur le lien dans la card)
  await page.getByTestId("voyage-card").filter({ hasText: "Lisbonne" }).first().getByRole("link").click();
  await expect(page).toHaveURL(/\/fr\/voyages\//);

  // Ajouter une réservation hôtel
  await page.getByTestId("reservation-form").locator('select[name="type"]').selectOption("hotel");
  await page.getByTestId("reservation-form").locator('input[name="fournisseur"]').fill("Hotel Lisboa");
  await page.getByTestId("reservation-form").getByRole("button").click();
  await expect(page.getByTestId("reservation-row").filter({ hasText: "Hotel Lisboa" })).toBeVisible();

  // Partager avec l'agence
  await page.getByTestId("share-form").locator('input[name="email"]').fill("agence@vito.test");
  await page.getByTestId("share-form").getByRole("button").click();

  // Un member-row pour l'agence doit apparaître (en plus du owner)
  await expect(
    page
      .getByTestId("member-row")
      .filter({ hasText: "agence" })
      .or(page.getByTestId("member-row").nth(1)),
  ).toBeVisible();
});

test("l'agence voit le voyage partagé par le seed", async ({ page }) => {
  await login(page, "agence@vito.test");
  await page.goto("/fr/voyages");
  // Le seed partage « Week-end à Rome » (owner=client) avec l'agence
  await expect(page.getByTestId("voyage-card").filter({ hasText: "Rome" })).toBeVisible();
});
