import { test, expect, type Page } from "@playwright/test";
import { expectVisibleWithReload } from "./helpers";

// display_name du seed client7b@vito.test — avant la policy profiles_select_co_membre
// (00021), l'agence ne pouvait pas lire le profil et la ligne affichait l'UUID ;
// ce test assertait ce comportement bugué.
const CLIENT7B = "Client 7b";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

test("l'agence relie un client, lui crée un voyage, le client le voit", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await login(pageA, "agence@vito.test");
  await pageA.goto("/fr/agence");

  // Relier le client dédié
  await pageA.getByTestId("lier-client-form").locator('input[name="email"]').fill("client7b@vito.test");
  await pageA.getByTestId("lier-client-form").getByRole("button").click();
  const row = pageA.getByTestId("client-row").filter({ hasText: CLIENT7B });
  await expectVisibleWithReload(pageA, row);

  // Créer un voyage pour ce client
  const titre = `Voyage Agence ${Date.now()}`;
  await row.getByTestId("voyage-client-form").locator('input[name="titre"]').fill(titre);
  await row.getByTestId("voyage-client-form").locator('input[name="destination"]').fill("Lisbonne");
  // Signal serveur DÉTERMINISTE (réponse du POST de l'action) plutôt que le ré-enable du
  // bouton : le `pending` disabled ne repasse false qu'au commit de la transition React
  // post-action, jamais garanti sous charge CI (jumelle de la famille fixée PR #112).
  await Promise.all([
    pageA.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/fr/agence")),
    row.getByTestId("voyage-client-form").getByRole("button").click(),
  ]);

  // Le client voit le voyage dans « Mes voyages » (il en est owner)
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await login(pageB, "client7b@vito.test");
  // refonte Lot A : le voyage créé par l'agence naît « planifie » → sous-onglet
  // « En préparation » (chip piloté par l'URL, survit aux reload-guards)
  await pageB.goto("/fr/voyages?chip=en_preparation");
  await expectVisibleWithReload(pageB, pageB.getByTestId("voyage-card").filter({ hasText: titre }));

  await ctxA.close();
  await ctxB.close();
});

test("un compte non-agence ne peut pas accéder à /agence", async ({ page }) => {
  await login(page, "client7b@vito.test");
  await page.goto("/fr/agence");
  // requireRole redirige les non-agence hors de /agence : on n'y reste pas et le contenu agence
  // n'est jamais rendu. (Assertion agnostique de la cible de redirection.)
  await expect(page).not.toHaveURL(/\/fr\/agence/);
  await expect(page.getByTestId("lier-client-form")).toHaveCount(0);
});
