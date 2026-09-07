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

// Incrément 3 : les deux listes, leur groupement, leurs filtres et leur recherche.
test("« En cours » groupe par membre, « Tous » filtre et cherche", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/activites");

  // Le seed donne l'équitation à Camille ET à Tom : elle doit apparaître dans
  // les deux groupes, sans quoi le compte de chacun mentirait.
  const groupes = page.getByTestId("activites-groupe");
  await expect(groupes).toHaveCount(2);
  await expect(groupes.filter({ hasText: "Camille" })).toContainText("2 activités");
  await expect(groupes.filter({ hasText: "Tom" })).toContainText("1 activité");

  // « En cours » ne montre que les activités en cours : la natation terminée
  // n'y est pas.
  await expect(page.getByTestId("activite-row").filter({ hasText: "Natation" })).toHaveCount(0);
  // Et la formule à la carte se décompte : 13 séances sur 20.
  await expect(page.getByTestId("activite-row").filter({ hasText: "Équitation" }).first())
    .toContainText("7 séances restantes");

  // « Tous » ouvre les statuts, et les dit.
  await page.getByTestId("onglet-tous").click();
  await expect(page.getByTestId("activite-row").filter({ hasText: "Natation" }).first())
    .toContainText("Terminée");

  // Filtres cumulables : ET entre dimensions, OU à l'intérieur.
  await page.getByTestId("filtre-statut-terminee").click();
  await expect(page).toHaveURL(/statut=terminee/);
  await expect(page.getByTestId("activites-compte")).toContainText("1 activité");
  await page.getByTestId("filtre-statut-en_cours").click();
  await expect(page.getByTestId("activites-compte")).toContainText("3 activités");

  // Effacer remet la liste entière, et l'URL avec.
  await page.getByTestId("filtres-effacer").click();
  await expect(page).not.toHaveURL(/statut=/);

  // La recherche couvre le club, pas seulement le nom de l'activité.
  await page.getByTestId("activites-recherche").fill("conservatoire");
  await expect(page).toHaveURL(/q=conservatoire/, { timeout: 10_000 });
  await expect(page.getByTestId("activite-row")).toHaveCount(1);
  await expect(page.getByTestId("activite-row").first()).toContainText("Danse");

  // Une recherche sans résultat explique quoi faire.
  await page.getByTestId("activites-recherche").fill("trompette");
  await expect(page.getByTestId("activites-vide")).toContainText("Aucune activité ne correspond");
});
