import { test, expect, type Page } from "@playwright/test";

const CLIENT7B = "99999999-9999-4999-8999-999999999999";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
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
  await expect(row).toBeVisible();

  // Créer un voyage pour ce client
  const titre = `Voyage Agence ${Date.now()}`;
  await row.getByTestId("voyage-client-form").locator('input[name="titre"]').fill(titre);
  await row.getByTestId("voyage-client-form").locator('input[name="destination"]').fill("Lisbonne");
  await row.getByTestId("voyage-client-form").getByRole("button").click();
  await expect(row.getByTestId("voyage-client-form").getByRole("button")).toBeEnabled({ timeout: 10000 });

  // Le client voit le voyage dans « Mes voyages » (il en est owner)
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await login(pageB, "client7b@vito.test");
  await pageB.goto("/fr/voyages");
  await expect(pageB.getByTestId("voyage-card").filter({ hasText: titre })).toBeVisible();

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
