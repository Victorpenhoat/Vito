import { test, expect } from "@playwright/test";
import { expectCountWithReload, expectVisibleWithReload, login } from "./helpers";

async function creerTag(page: import("@playwright/test").Page, label: string) {
  await page.getByTestId("tag-nouveau").click();
  await page.getByTestId("tag-form").locator('input[name="label"]').fill(label);
  await page.getByTestId("tag-form").getByRole("button", { name: "Enregistrer" }).click();
  // reload-guard : race RSC post-action documentée (#71/#77)
  await expectVisibleWithReload(page, page.getByTestId("tag-row").filter({ hasText: label }));
}

// Tests séparés : chaque étape (création/renommage/suppression) peut coûter un
// reload-guard sous charge — un test unique explosait le budget de 30 s.

test("créer puis renommer un tag personnel", async ({ page }) => {
  await login(page);
  await page.goto("/fr/restos/tags");
  await expect(page.getByTestId("tags-admin")).toBeVisible();
  // les tags système sont listés (Terrasse vient des migrations)
  await expect(page.getByTestId("tag-row").filter({ hasText: "Terrasse" }).first()).toBeVisible();

  const label = `Tag E2E ${Date.now()}`;
  await creerTag(page, label);

  const renomme = `${label} v2`;
  await page.getByTestId("tag-row").filter({ hasText: label }).getByRole("button").click();
  await page.getByTestId("tag-form").locator('input[name="label"]').fill(renomme);
  await page.getByTestId("tag-form").getByRole("button", { name: "Enregistrer" }).click();
  await expectVisibleWithReload(page, page.getByTestId("tag-row").filter({ hasText: renomme }));
});

test("supprimer un tag personnel ; les tags système restent en lecture seule", async ({ page }) => {
  await login(page);
  await page.goto("/fr/restos/tags");
  const label = `Tag E2E suppr ${Date.now()}`;
  await creerTag(page, label);

  page.on("dialog", (d) => d.accept());
  await page.getByTestId("tag-row").filter({ hasText: label }).getByRole("button").click();
  await page.getByTestId("tag-supprimer").click();
  await expectCountWithReload(page, page.getByTestId("tag-row").filter({ hasText: label }), 0);

  // Un tag système n'expose pas de menu d'édition (lecture seule)
  const systeme = page.getByTestId("tag-row").filter({ hasText: "En famille" }).first();
  await expect(systeme).toBeVisible();
  await expect(systeme.getByRole("button")).toHaveCount(0);
});