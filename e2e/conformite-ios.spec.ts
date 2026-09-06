import { test, expect } from "@playwright/test";
import { login } from "./helpers";

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

// Règle 3.1.1 : l'abonnement ne se propose pas dans la coque iOS. Le serveur le
// sait au User-Agent, donc la page ne rend ni prix ni bouton — plutôt que de les
// rendre puis de les cacher.
test("dans la coque iOS, l'abonnement ne montre ni prix ni bouton", async ({ browser }) => {
  const contexte = await browser.newContext({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 VitoiOS",
  });
  const page = await contexte.newPage();
  await login(page, "client@vito.test");
  await page.goto("/fr/abonnement");

  await expect(page.getByTestId("abonnement-coque")).toBeVisible();
  await expect(page.getByTestId("subscribe-form")).toHaveCount(0);
  await expect(page.getByTestId("subscribe-monthly")).toHaveCount(0);
  // Aucun prix nulle part : c'est ce qu'Apple regarde.
  await expect(page.locator("body")).not.toContainText("€");
  // Et l'entrée de menu a disparu.
  await expect(page.getByRole("link", { name: "Abonnement" })).toHaveCount(0);

  await contexte.close();
});

test("sur le web, l'abonnement reste entier", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/abonnement");
  await expect(page.getByTestId("subscribe-form")).toBeVisible();
  await expect(page.getByTestId("abonnement-coque")).toHaveCount(0);
});
