import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Incrément 2 : l'onglet existe, ses quatre vues se partagent par l'URL, et un
// carnet vide explique quoi y mettre plutôt que de constater le vide.
test("l'onglet Activités s'ouvre, et ses vues vivent dans l'URL", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/accueil");

  await page.getByTestId("sidebar").getByRole("link", { name: "Activités" }).click();
  await expect(page).toHaveURL(/\/fr\/activites$/);
  await expect(page.getByRole("heading", { name: "Activités", level: 1 })).toBeVisible();

  // Quatre vues, dans l'ordre du design.
  const onglets = page.getByTestId("activites-onglets");
  for (const nom of ["En cours", "Cette semaine", "Tous", "Carte"]) {
    await expect(onglets.getByRole("link", { name: nom })).toBeVisible();
  }

  // Un carnet vide dit ce qu'on gagne à le remplir.
  await expect(page.getByTestId("activites-vide")).toContainText("Aucune activité");

  // La vue vit dans l'URL : rechargée ou partagée, elle retombe où elle était.
  await onglets.getByRole("link", { name: "Cette semaine" }).click();
  await expect(page).toHaveURL(/onglet=semaine/);
  await page.reload();
  await expect(page.getByTestId("onglet-semaine")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("activites-vide")).toContainText("Aucun cours cette semaine");

  // Une valeur d'onglet inventée retombe sur la vue par défaut plutôt que sur
  // un écran vide sans explication.
  await page.goto("/fr/activites?onglet=nimporte-quoi");
  await expect(page.getByTestId("onglet-en_cours")).toHaveAttribute("aria-current", "page");
});

// La barre du bas est l'écran mobile du design : Activités y entre, Accueil en
// sort. Elle est masquée au-delà de md, d'où le viewport de téléphone.
test.describe("barre du bas (mobile)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Activités prend la place d'Accueil", async ({ page }) => {
    await login(page, "client@vito.test");
    await page.goto("/fr/restos");

    const barre = page.getByTestId("bottom-nav");
    await expect(barre.getByRole("link", { name: "Activités" })).toBeVisible();
    await expect(barre.getByRole("link", { name: "Accueil" })).toHaveCount(0);

    await barre.getByRole("link", { name: "Activités" }).click();
    await expect(page).toHaveURL(/\/fr\/activites$/);
  });
});
