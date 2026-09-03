import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("redirige les non-authentifiés hors de /restos", async ({ page }) => {
  await page.goto("/fr/restos");
  await expect(page).toHaveURL(/\/fr\/login/);
});

test("le client se connecte par mot de passe (repli) et atteint /accueil", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/fr\/accueil/);
});

test("la connexion met le lien par email en avant", async ({ page }) => {
  await page.goto("/fr/login");
  await expect(page.getByTestId("envoyer-lien")).toBeVisible();
  // le mot de passe n'apparaît qu'à la demande
  await expect(page.getByTestId("champ-mot-de-passe")).toHaveCount(0);
  await page.getByTestId("utiliser-mot-de-passe").click();
  await expect(page.getByTestId("champ-mot-de-passe")).toBeVisible();
});
