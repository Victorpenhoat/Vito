import { test, expect } from "@playwright/test";
import { expectVisibleWithReload, login } from "./helpers";

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

// Incrément 4 : la fiche, et les deux formulaires qui la remplissent.
test("créer une activité, lui ajouter un créneau, la mettre en pause", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/activites");

  const marque = String(Date.now()).slice(-6);
  await page.getByTestId("activite-ajouter").click();
  const form = page.getByTestId("activite-form");
  await form.getByTestId("activite-nom").fill(`Judo ${marque}`);
  await form.getByTestId("activite-type").selectOption("autre");
  await form.getByTestId("activite-club").fill("Dojo du port");
  await form.getByTestId("activite-telephone").fill("05 56 00 00 00");
  await form.getByTestId("activite-formule").fill("10");
  await form.locator('input[name="membres"]').first().check();
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    form.getByTestId("activite-valider").click(),
  ]);

  // On atterrit sur la fiche : c'est là qu'on remplit le reste.
  await expect(page).toHaveURL(/\/fr\/activites\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: `Judo ${marque}` })).toBeVisible();
  await expect(page.getByTestId("fiche-activite")).toContainText("Dojo du port");

  // Une activité sans créneau le dit, plutôt que d'afficher une liste vide.
  await expect(page.getByTestId("fiche-activite")).toContainText("Aucun créneau");

  // Ajout d'un créneau, avec « qui dépose » laissé à définir.
  await page.getByTestId("creneau-ajouter").click();
  const creneau = page.getByTestId("creneau-form");
  await creneau.getByTestId("creneau-jour").selectOption("3");
  await creneau.getByTestId("creneau-debut").fill("18:00");
  await creneau.getByTestId("creneau-fin").fill("19:30");
  await creneau.getByTestId("creneau-intervenant").fill("Sensei Martin");
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    creneau.getByTestId("creneau-valider").click(),
  ]);

  const ligne = page.getByTestId("fiche-creneau").filter({ hasText: "Sensei Martin" });
  await expectVisibleWithReload(page, ligne, { timeout: 15_000 });
  await expect(ligne).toContainText("mercredi");
  await expect(ligne).toContainText("18h00");
  // Null porte du sens : « à définir » est une réponse, pas un champ oublié.
  await expect(ligne).toContainText("Dépose à définir");

  // La formule se décompte dès qu'elle existe, sans aucune séance pointée.
  await expect(page.getByTestId("fiche-presence")).toContainText("0 / 10");

  // Le statut se change là où on le lit.
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    page.getByTestId("fiche-statut").selectOption("en_pause"),
  ]);
  await page.goto("/fr/activites");
  await expect(page.getByTestId("activite-row").filter({ hasText: `Judo ${marque}` })).toHaveCount(0);
  await page.getByTestId("onglet-tous").click();
  await expect(page.getByTestId("activite-row").filter({ hasText: `Judo ${marque}` }).first())
    .toContainText("En pause");
});

// La fiche du seed montre ce que la maquette décrit : horaires, dépose,
// présence et échéances.
test("la fiche dit où, quand, avec qui et combien", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/activites");
  await page.getByTestId("activite-row").filter({ hasText: "Équitation" }).first()
    .getByRole("link").first().click();

  await expect(page.getByTestId("fiche-activite")).toContainText("Poney-club des Landes");
  await expect(page.getByTestId("fiche-membre").first()).toBeVisible();
  const creneau = page.getByTestId("fiche-creneau").first();
  await expect(creneau).toContainText("samedi");
  await expect(creneau).toContainText("Manège couvert");
  await expect(creneau).toContainText("Dépose : Camille");
  // 12 faites + 1 manquée = 13 consommées sur 20.
  await expect(page.getByTestId("fiche-presence")).toContainText("13 / 20");
  await expect(page.getByTestId("fiche-activite")).toContainText("7 séances restantes");
});

// Sur grand écran, la fiche s'ouvre à côté de la liste — même composition que
// le carnet des restos, pour passer d'une activité à l'autre sans aller-retour.
test("desktop : la fiche s'ouvre à côté de la liste, et la ligne ouverte se voit", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/activites");
  await page.getByTestId("activite-row").filter({ hasText: "Danse" }).first()
    .getByRole("link").first().click();

  await expect(page.getByTestId("activites-liste-detail")).toBeVisible();
  await expect(page.getByTestId("activites-detail")).toContainText("Conservatoire");
  // La liste reste là, et signale la ligne ouverte.
  await expect(page.getByTestId("activite-row").filter({ hasText: "Équitation" }).first()).toBeVisible();
  await expect(page.getByTestId("activite-row").filter({ hasText: "Danse" }).first())
    .toHaveAttribute("aria-current", "true");

  // On passe à une autre activité sans revenir en arrière.
  await page.getByTestId("activite-row").filter({ hasText: "Équitation" }).first()
    .getByRole("link").first().click();
  await expect(page.getByTestId("activites-detail")).toContainText("Poney-club des Landes");
});
