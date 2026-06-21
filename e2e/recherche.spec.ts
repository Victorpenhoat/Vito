import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("régler ses goûts puis rechercher : ta liste d'abord + recommandations", async ({ page }) => {
  await login(page);

  // Goûts : cocher bistrot, enregistrer
  await page.goto("/fr/gouts");
  await page.getByTestId("gouts-form").locator('input[name="typesPreferes"][value="bistrot"]').check();
  await page.getByTestId("gouts-form").getByRole("button").click();

  // Recherche par zone 17e
  await page.goto("/fr/recherche?zone=17e");
  await expect(page.getByTestId("ma-liste-section")).toBeVisible();
  await expect(page.getByTestId("recos-section")).toBeVisible();
  // Le pool démo contient des restos du 17e absents de la liste -> au moins une reco
  await expect(page.getByTestId("recos-section").getByTestId("resto-result").first()).toBeVisible();
});
