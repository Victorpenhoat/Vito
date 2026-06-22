import { test, expect } from "@playwright/test";

test("l'accueil présente la marque, le slogan et les onglets", async ({ page }) => {
  await page.goto("/fr");
  const landing = page.getByTestId("landing");
  await expect(landing).toBeVisible();
  await expect(landing).toContainText("Vito");
  await expect(landing).toContainText("Votre carnet personnel de sorties et de voyages");
  await expect(page.getByTestId("tab-login")).toBeVisible();
  await expect(page.getByTestId("tab-signup")).toBeVisible();
});

test("basculer sur l'onglet Inscription change le bouton de soumission", async ({ page }) => {
  await page.goto("/fr");
  const submit = page.locator('form button[type="submit"]');
  await expect(submit).toHaveText("Connexion");
  await page.getByTestId("tab-signup").click();
  await expect(submit).toHaveText("Créer un compte");
});

test("connexion depuis l'accueil redirige vers /restos", async ({ page }) => {
  await page.goto("/fr");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/fr\/restos/);
});
