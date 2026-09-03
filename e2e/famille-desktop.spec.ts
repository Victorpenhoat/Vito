import { test, expect } from "@playwright/test";
import { expectVisibleWithReload, login } from "./helpers";

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("rail visible, navigation vers la fiche + aperçu du document", async ({ page }) => {
    await login(page, "client@vito.test");
    await page.goto("/fr/famille");
    // rail desktop : le proche seedé « Camille Durand » y figure
    const railLink = page.getByTestId("famille-rail").getByRole("link", { name: /Camille Durand/ });
    await expect(railLink.first()).toBeVisible();
    await railLink.first().click();
    await expect(page).toHaveURL(/\/famille\/proches\//);
    await expectVisibleWithReload(page, page.getByRole("heading", { name: "Camille Durand" }));
    // aperçu : depuis la refonte Cercle, le scan s'affiche sur le détail du document
    // .first() : les re-runs locaux accumulent des passeports sur Camille (DB non
    // réinitialisée entre runs) — plusieurs lignes matchent sinon (strict mode).
    await page.getByTestId("document-row").getByRole("link", { name: /Passeport/ }).first().click();
    await expect(page).toHaveURL(/\/documents\/[^/]+$/);
    await expect(page.locator('iframe[title="Aperçu"]')).toBeVisible();
  });

  test("tunnel desktop : stepper horizontal visible", async ({ page }) => {
    await login(page, "client@vito.test");
    await page.goto("/fr/famille");
    await page.getByTestId("famille-rail").getByRole("link", { name: /Camille Durand/ }).first().click();
    await expectVisibleWithReload(page, page.getByRole("heading", { name: "Camille Durand" }));
    await page.getByRole("link", { name: "Ajouter un document" }).click();
    await expect(page.getByText("Vérification", { exact: true })).toBeVisible(); // libellé du StepIndicator
  });
});

test.describe("mobile (non-régression)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("rail masqué, liste mobile affichée", async ({ page }) => {
    await login(page, "client@vito.test");
    await page.goto("/fr/famille");
    // la liste mobile (proche-row) reste ; le rail n'apparaît pas comme nav distincte de proches cliquables en colonne
    await expect(page.getByTestId("proche-row").filter({ hasText: "Camille Durand" })).toBeVisible();
  });
});
