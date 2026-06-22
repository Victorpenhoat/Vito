import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

async function creerVoyage(page: Page, titre: string) {
  await page.getByTestId("voyage-form").locator('input[name="titre"]').fill(titre);
  await page.getByTestId("voyage-form").getByRole("button").click();
}

test("Free atteint la limite de voyages, souscrit, puis crée au-delà", async ({ page }) => {
  await login(page, "free@vito.test");
  await page.goto("/fr/voyages");

  const tag = Date.now();
  // 2 créations OK (limite Free = 2)
  await creerVoyage(page, `V1 ${tag}`);
  await expect(page.getByTestId("voyage-card").filter({ hasText: `V1 ${tag}` })).toBeVisible();
  await creerVoyage(page, `V2 ${tag}`);
  await expect(page.getByTestId("voyage-card").filter({ hasText: `V2 ${tag}` })).toBeVisible();

  // 3e création bloquée -> CTA upgrade (signal déterministe)
  await creerVoyage(page, `V3 ${tag}`);
  await expect(page.getByTestId("voyage-limit-cta")).toBeVisible();
  await expect(page.getByTestId("voyage-card").filter({ hasText: `V3 ${tag}` })).toHaveCount(0);

  // Souscrire (mock) -> premium
  await page.goto("/fr/abonnement");
  await page.getByTestId("subscribe-monthly").click();
  await expect(page.getByTestId("premium-badge")).toBeVisible();

  // Le 3e voyage passe désormais
  await page.goto("/fr/voyages");
  await creerVoyage(page, `V3 ${tag}`);
  await expect(page.getByTestId("voyage-card").filter({ hasText: `V3 ${tag}` })).toBeVisible();
});

test("Premium annule : reste premium jusqu'à la fin de période", async ({ page }) => {
  await login(page, "premium@vito.test");
  await page.goto("/fr/abonnement");
  await expect(page.getByTestId("premium-badge")).toBeVisible();

  await page.getByTestId("cancel-sub").click();
  // Toujours premium, mais libellé « Premium jusqu'au ... »
  await expect(page.getByTestId("premium-badge")).toBeVisible();
  await expect(page.getByTestId("plan-actuel")).toContainText("jusqu'au");
});
