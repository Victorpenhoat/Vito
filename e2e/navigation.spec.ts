import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("sidebar visible, bottom-nav masquée, actif + gating admin (client)", async ({ page }) => {
    await login(page, "client@vito.test");
    await page.goto("/fr/restos");
    await expect(page.getByTestId("sidebar")).toBeVisible();
    await expect(page.getByTestId("bottom-nav")).toBeHidden();
    await expect(page.getByTestId("nav-restos")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("nav-admin")).toHaveCount(0);
  });

  test("navigation via la sidebar", async ({ page }) => {
    await login(page, "client@vito.test");
    await page.goto("/fr/restos");
    await page.getByTestId("nav-voyages").click();
    await expect(page).toHaveURL(/\/fr\/voyages/);
  });

  test("le thème est sombre par défaut + déconnexion", async ({ page }) => {
    await login(page, "client@vito.test");
    await page.goto("/fr/restos");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Déconnexion" }).click();
    await expect(page).toHaveURL(/\/fr\/login/);
  });

  test("admin voit le lien Admin", async ({ page }) => {
    await login(page, "admin@vito.test");
    await page.goto("/fr/restos");
    await expect(page.getByTestId("nav-admin")).toBeVisible();
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("bottom-nav visible, sidebar masquée, drawer ouvrable", async ({ page }) => {
    await login(page, "client@vito.test");
    await page.goto("/fr/restos");
    await expect(page.getByTestId("bottom-nav")).toBeVisible();
    await expect(page.getByTestId("sidebar")).toBeHidden();
    await expect(page.getByTestId("drawer")).toHaveCount(0);
    await page.getByTestId("drawer-open").click();
    await expect(page.getByTestId("drawer")).toBeVisible();
  });
});
