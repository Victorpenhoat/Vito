import { test, expect } from "@playwright/test";
import { expectVisibleWithReload, expectCountWithReload } from "./helpers";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

test("créer, renommer puis supprimer un tag personnel (les système restent intouchés)", async ({ page }) => {
  await login(page);
  await page.goto("/fr/restos/tags");
  await expect(page.getByTestId("tags-admin")).toBeVisible();

  // les tags système sont listés (Terrasse vient des migrations)
  await expect(page.getByTestId("tag-row").filter({ hasText: "Terrasse" }).first()).toBeVisible();

  // Créer — label unique par tentative (base non réinitialisée entre retries)
  const label = `Tag E2E ${Date.now()}`;
  await page.getByTestId("tag-nouveau").click();
  await page.getByTestId("tag-form").locator('input[name="label"]').fill(label);
  await page.getByTestId("tag-form").getByRole("button", { name: "Enregistrer" }).click();
  // reload-guard : le refresh RSC post-action peut ne jamais se commettre sous
  // charge (race documentée #71/#77) — rendu frais depuis la base au besoin.
  const row = page.getByTestId("tag-row").filter({ hasText: label });
  await expectVisibleWithReload(page, row);

  // Renommer via le menu de la ligne
  const renomme = `${label} v2`;
  await row.getByRole("button").click();
  await page.getByTestId("tag-form").locator('input[name="label"]').fill(renomme);
  await page.getByTestId("tag-form").getByRole("button", { name: "Enregistrer" }).click();
  await expectVisibleWithReload(page, page.getByTestId("tag-row").filter({ hasText: renomme }));

  // Supprimer (confirm auto-accepté)
  page.on("dialog", (d) => d.accept());
  await page.getByTestId("tag-row").filter({ hasText: renomme }).getByRole("button").click();
  await page.getByTestId("tag-supprimer").click();
  await expectCountWithReload(page, page.getByTestId("tag-row").filter({ hasText: renomme }), 0);

  // Un tag système n'expose pas de menu d'édition (lecture seule)
  const systeme = page.getByTestId("tag-row").filter({ hasText: "En famille" }).first();
  await expect(systeme).toBeVisible();
  await expect(systeme.getByRole("button")).toHaveCount(0);
});