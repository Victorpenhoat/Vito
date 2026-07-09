import { test, expect, type Page } from "@playwright/test";

const SUPABASE_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SEED_GROUPE_ID = "66666666-6666-4666-8666-666666666666";

/** Wipe all remboursements from the seed groupe so test 2 is idempotent. */
async function resetSeedGroupe(request: import("@playwright/test").APIRequestContext) {
  await request.delete(
    `${SUPABASE_URL}/rest/v1/remboursements?groupe_id=eq.${SEED_GROUPE_ID}`,
    { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
  );
}

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
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

  // Partager avec l'agence (pour avoir 2 participants). Le refresh RSC post-action peut
  // revenir vide sous charge (race documentée #71/#77) → l'agence n'apparaît pas en place ;
  // récupération par reload (rendu frais depuis la base), comme l'archivage #77.
  await page.getByTestId("share-form").locator('input[name="email"]').fill("agence@vito.test");
  await page.getByTestId("share-form").getByRole("button").click();
  const deuxMembres = page.getByTestId("member-row").filter({ hasText: "agence" }).or(page.getByTestId("member-row").nth(1));
  try {
    await expect(deuxMembres).toBeVisible();
  } catch {
    await page.reload();
    await expect(deuxMembres).toBeVisible();
  }

  // Ajouter une dépense égale de 30,00 € payée par le client, participants = tous (cochés par défaut)
  await page.getByTestId("depense-form").locator('input[name="libelle"]').fill("Taxi");
  await page.getByTestId("depense-form").locator('input[name="montant"]').fill("30");
  await page.getByTestId("depense-form").getByRole("button").click();

  // La dépense apparaît (signal déterministe) et les soldes sont calculés
  await expect(page.getByTestId("depense-row").filter({ hasText: "Taxi" })).toBeVisible();
  await expect(page.getByTestId("soldes-panel")).toContainText("15,00");
});

test("l'agence voit le compte partagé du seed, ajoute un remboursement, le compte est soldé", async ({ page, request }) => {
  // Reset seed groupe state so this test is idempotent across re-runs.
  await resetSeedGroupe(request);

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

  // Après remboursement, plus aucun transfert : « Tout est réglé. ». Le refresh RSC
  // post-action peut revenir vide sous charge (race documentée #71/#77) → récupération
  // par reload (rendu frais depuis la base), comme le partage en test 1.
  const soldeRegle = page.getByTestId("solde-regle");
  try {
    await expect(soldeRegle).toBeVisible();
  } catch {
    await page.reload();
    await expect(soldeRegle).toBeVisible();
  }
});
