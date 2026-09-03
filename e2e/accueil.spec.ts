import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("après login on atterrit sur le dashboard", async ({ page }) => {
  await login(page, "client@vito.test");
  await expect(page.getByTestId("accueil")).toBeVisible();
  await expect(page.getByTestId("hero")).toBeVisible();
});

test("le dashboard montre salutation, KPI et activité", async ({ page }) => {
  await login(page, "client@vito.test");
  await expect(page.getByTestId("hero")).toContainText(/Bonjour|Bonsoir/);
  await expect(page.getByTestId("kpi-tiles").locator("> div")).toHaveCount(4);
  await expect(page.getByTestId("recent-activity")).toBeVisible();
  // FAB scoping au main pour éviter la collision avec le lien Conciergerie de la nav (hors main)
  await expect(page.getByTestId("accueil").getByRole("link", { name: "Demande de conciergerie" })).toBeVisible();
});
