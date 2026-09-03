import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("l'accueil présente la marque, le slogan et les onglets", async ({ page }) => {
  await page.goto("/fr");
  const landing = page.getByTestId("landing");
  await expect(landing).toBeVisible();
  await expect(landing).toContainText("Vito");
  await expect(landing).toContainText("Votre carnet personnel de sorties et de voyages");
  await expect(page.getByTestId("tab-login")).toBeVisible();
  await expect(page.getByTestId("tab-signup")).toBeVisible();
});

test("l'onglet Connexion propose le lien par email, l'onglet Inscription renvoie à l'invitation", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.getByTestId("connexion-panel")).toBeVisible();
  await expect(page.getByTestId("envoyer-lien")).toBeVisible();
  // Vito se rejoint sur invitation : plus de formulaire d'inscription ici (lot O-C)
  await page.getByTestId("tab-signup").click();
  await expect(page.getByTestId("inscription-sur-invitation")).toBeVisible();
});

test("connexion par mot de passe depuis /login redirige vers /accueil", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/fr\/accueil/);
});
