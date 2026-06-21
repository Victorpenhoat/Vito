import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("créer un compte partagé, partager, ajouter une dépense égale, vérifier les soldes", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/depenses");

  const titre = `Compte E2E ${Date.now()}`;
  await page.getByTestId("groupe-form").locator('input[name="titre"]').fill(titre);
  await page.getByTestId("groupe-form").getByRole("button").click();
  await expect(page.getByTestId("groupe-card").filter({ hasText: titre }).first()).toBeVisible();

  await page.getByTestId("groupe-card").filter({ hasText: titre }).first().getByRole("link").click();
  await expect(page).toHaveURL(/\/fr\/depenses\//);

  // Partager avec l'agence (pour avoir 2 participants)
  await page.getByTestId("share-form").locator('input[name="email"]').fill("agence@vito.test");
  await page.getByTestId("share-form").getByRole("button").click();
  await expect(page.getByTestId("member-row").filter({ hasText: "agence" }).or(page.getByTestId("member-row").nth(1))).toBeVisible();

  // Ajouter une dépense égale de 30,00 € payée par le client, participants = tous (cochés par défaut)
  await page.getByTestId("depense-form").locator('input[name="libelle"]').fill("Taxi");
  await page.getByTestId("depense-form").locator('input[name="montant"]').fill("30");
  await page.getByTestId("depense-form").getByRole("button").click();

  // La dépense apparaît (signal déterministe) et les soldes sont calculés
  await expect(page.getByTestId("depense-row").filter({ hasText: "Taxi" })).toBeVisible();
  await expect(page.getByTestId("soldes-panel")).toContainText("15,00");
});

test("l'agence voit le compte partagé du seed, ajoute un remboursement, le compte est soldé", async ({ page }) => {
  await login(page, "agence@vito.test");
  await page.goto("/fr/depenses");

  await page.getByTestId("groupe-card").filter({ hasText: "Dépenses Rome" }).first().getByRole("link").click();
  await expect(page).toHaveURL(/\/fr\/depenses\//);

  // Soldes du seed : un transfert de 50,00 € est suggéré (agence doit 50,00 € au client)
  await expect(page.getByTestId("soldes-panel")).toContainText("50,00");

  // L'agence rembourse 50,00 € au client (de=agence, vers=client) — sélection par
  // valeur (profile_id du seed) pour un sens déterministe, indépendant de l'ordre d'affichage.
  const CLIENT = "11111111-1111-1111-1111-111111111111";
  const AGENCE = "22222222-2222-2222-2222-222222222222";
  const form = page.getByTestId("remboursement-form");
  await form.locator('select[name="deProfileId"]').selectOption(AGENCE);
  await form.locator('select[name="versProfileId"]').selectOption(CLIENT);
  await form.locator('input[name="montant"]').fill("50");
  await form.getByRole("button").click();

  // Après remboursement, plus aucun transfert : « Tout est réglé. »
  await expect(page.getByTestId("solde-regle")).toBeVisible();
});
