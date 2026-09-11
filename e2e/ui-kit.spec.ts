import { test, expect } from "@playwright/test";

test("la page kit UI s'affiche", async ({ page }) => {
  await page.goto("/fr/ui-kit");
  await expect(page.getByTestId("ui-kit")).toBeVisible();
  await expect(page.getByText("Kit UI — Vito")).toBeVisible();
});

test("le toggle de thème bascule data-theme sur <html>", async ({ page }) => {
  await page.goto("/fr/ui-kit");
  const html = page.locator("html");
  // Le SOMBRE est le défaut (aucun cookie → sombre), comme les maquettes.
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", "dark");
});

test("sans cookie, le HTML servi est déjà sombre", async ({ page, context }) => {
  // On lit le HTML SERVI, pas le DOM : c'est le rendu serveur qui doit être
  // sombre. Si le défaut n'était corrigé qu'après hydratation, la page
  // clignoterait en clair à chaque ouverture et ce test ne le verrait pas.
  await context.clearCookies();
  const reponse = await page.goto("/fr/login");
  const html = await reponse!.text();
  expect(html).toContain('data-theme="dark"');
});

test("la modale s'ouvre et se ferme", async ({ page }) => {
  await page.goto("/fr/ui-kit");
  await expect(page.getByTestId("modal")).toHaveCount(0);
  await page.getByRole("button", { name: "Ouvrir la modale" }).click();
  await expect(page.getByTestId("modal")).toBeVisible();
  await page.getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByTestId("modal")).toHaveCount(0);
});
