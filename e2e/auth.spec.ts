import { test, expect } from "@playwright/test";

test("redirige les non-authentifiés hors de /restos", async ({ page }) => {
  await page.goto("/fr/restos");
  await expect(page).toHaveURL(/\/fr\/login/);
});

test("le client se connecte et atteint /restos", async ({ page }) => {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
});
