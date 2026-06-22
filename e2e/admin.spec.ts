import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("l'admin voit le tableau de bord (KPI + tableaux)", async ({ page }) => {
  await login(page, "admin@vito.test");
  await page.goto("/fr/admin");
  await expect(page.getByTestId("admin-stats")).toBeVisible();
  // Assertion STABLE : la table users contient l'admin (display_name « Admin », jamais muté).
  // (On n'assert PAS de contenu d'abonnement/demande : leur état varie selon les tests parallèles
  //  — 6a annule premium@vito, 6b répond à la demande seed. On vérifie donc la présence des tables.)
  await expect(page.getByTestId("users-table")).toContainText("Admin");
  await expect(page.getByTestId("subscriptions-table")).toBeVisible();
  await expect(page.getByTestId("demandes-table")).toBeVisible();
});

test("un non-admin ne peut pas accéder à /admin", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/admin");
  await expect(page).not.toHaveURL(/\/fr\/admin/);
  await expect(page.getByTestId("admin-stats")).toHaveCount(0);
});
