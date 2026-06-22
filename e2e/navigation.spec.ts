import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("la barre de navigation est visible, l'onglet courant actif, Admin masqué (client)", async ({ page }) => {
  await login(page, "client@vito.test");
  await expect(page.getByTestId("app-nav")).toBeVisible();
  await expect(page.getByTestId("nav-restos")).toBeVisible();
  await expect(page.getByTestId("nav-voyages")).toBeVisible();
  await expect(page.getByTestId("nav-restos")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("nav-admin")).toHaveCount(0);
});

test("naviguer via la barre change d'écran", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.getByTestId("nav-voyages").click();
  await expect(page).toHaveURL(/\/fr\/voyages/);
  await expect(page.getByTestId("app-nav")).toBeVisible();
});

test("la déconnexion depuis la barre renvoie au login", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL(/\/fr\/login/);
});

test("le lien Admin apparaît pour un admin", async ({ page }) => {
  await login(page, "admin@vito.test");
  await expect(page.getByTestId("nav-admin")).toBeVisible();
});
