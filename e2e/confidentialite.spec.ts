import { test, expect } from "@playwright/test";

// Apple exige une politique de confidentialité accessible SANS COMPTE : c'est
// l'URL qu'on donne dans App Store Connect, et un reviewer la suit avant même
// d'ouvrir l'app.
test("la politique de confidentialité s'ouvre sans être connecté", async ({ page }) => {
  await page.goto("/fr/confidentialite");
  // Pas de redirection vers la connexion : la page vit hors du groupe (app).
  await expect(page).toHaveURL(/\/fr\/confidentialite$/);
  await expect(page.getByRole("heading", { name: "Confidentialité", level: 1 })).toBeVisible();
  // Les deux promesses qui comptent, et qu'un reviewer vient vérifier.
  await expect(page.getByText("Votre position", { exact: false })).toBeVisible();
  await expect(page.getByText("Aucun suivi publicitaire", { exact: false })).toBeVisible();
});
