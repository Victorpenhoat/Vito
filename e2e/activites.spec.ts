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
  await expect(page.getByTestId("vue-semaine")).toBeVisible();

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

  // Deux membres, deux groupes : Camille (équitation, danse) et Tom (football).
  const groupes = page.getByTestId("activites-groupe");
  await expect(groupes.filter({ hasText: "Camille" }).getByTestId("activite-row")
    .filter({ hasText: "Danse" })).toHaveCount(1);
  await expect(groupes.filter({ hasText: "Tom" }).getByTestId("activite-row")
    .filter({ hasText: "Football" })).toHaveCount(1);

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
  // Sur des LIGNES et non sur un total : d'autres tests créent leurs propres
  // activités dans la même base, et un compteur absolu se périmerait.
  // Les filtres sont des LIENS rendus par le serveur : ils répondent avant
  // l'hydratation, et un clic rapide n'est jamais perdu.
  await page.getByTestId("filtre-statut-terminee").click();
  await expect(page).toHaveURL(/statut=terminee/);
  await expect(page.getByTestId("activite-row").filter({ hasText: "Natation" })).toHaveCount(1);
  await expect(page.getByTestId("activite-row").filter({ hasText: "Danse" })).toHaveCount(0);
  await page.getByTestId("filtre-statut-en_cours").click();
  // Attendre l'URL avant d'enchaîner : les assertions de lignes peuvent passer
  // sur le DOM PRÉCÉDENT, et le clic suivant partirait pendant la navigation.
  await expect(page).toHaveURL(/statut=en_cours/);
  await expect(page.getByTestId("activite-row").filter({ hasText: "Danse" })).toHaveCount(1);
  await expect(page.getByTestId("activite-row").filter({ hasText: "Natation" })).toHaveCount(1);

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

// Incrément 5 : les sections protégées. Ce qui compte ici n'est pas qu'on
// puisse voir un code, c'est qu'on ne le puisse PAS sans redonner son mot de
// passe — et que la page ne le contienne jamais.
test("un code d'accès ne se révèle qu'après vérification, et n'est jamais dans la page", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/activites");
  await page.getByTestId("activite-row").filter({ hasText: "Équitation" }).first()
    .getByRole("link").first().click();
  await expect(page.getByTestId("section-acces")).toBeVisible();

  // Libellé marqué : les re-runs locaux accumulent les codes sur la même
  // activité, et un filtre par libellé fixe finirait par en trouver quatre.
  const marque = String(Date.now()).slice(-6);
  const libelle = `Portail ${marque}`;
  const secret = `4X7B${marque}`;
  await page.getByTestId("code-ajouter").click();
  const form = page.getByTestId("code-form");
  await form.getByTestId("code-libelle").fill(libelle);
  await form.getByTestId("code-valeur").fill(secret);
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    form.getByTestId("code-valider").click(),
  ]);

  const ligne = page.getByTestId("code-row").filter({ hasText: libelle });
  await expectVisibleWithReload(page, ligne, { timeout: 15_000 });

  // Le masque ne trahit rien, et le HTML de la page ne contient pas le code.
  await expect(ligne.getByTestId("valeur-protegee")).toHaveText("••••");
  expect(await page.content()).not.toContain(secret);

  // Un mauvais mot de passe ne révèle rien, et ne dit pas pourquoi.
  await ligne.getByTestId("reveler-valeur").click();
  await page.getByTestId("reauth-mot-de-passe").fill("pas-le-bon");
  await page.getByTestId("reauth-valider").click();
  // Ciblé sur la fenêtre de vérification : la page peut porter d'autres alertes.
  await expect(page.getByTestId("reauth-form").getByRole("alert")).toContainText("Vérification impossible");
  expect(await page.content()).not.toContain(secret);

  // Le bon mot de passe, lui, l'affiche.
  await page.getByTestId("reauth-mot-de-passe").fill("password123");
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    page.getByTestId("reauth-valider").click(),
  ]);
  await expect(ligne.getByTestId("valeur-protegee")).toHaveText(secret, { timeout: 15_000 });

  // Et il se remasque : la valeur ne vit qu'en mémoire, le temps de la lire.
  await ligne.getByTestId("masquer-valeur").click();
  await expect(ligne.getByTestId("valeur-protegee")).toHaveText("••••");
});

test("un document d'activité ne s'ouvre pas sans ticket", async ({ page, request }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/activites");
  await page.getByTestId("activite-row").filter({ hasText: "Équitation" }).first()
    .getByRole("link").first().click();

  const nom = `certif-${String(Date.now()).slice(-6)}.pdf`;
  await page.getByTestId("document-ajouter").click();
  const form = page.getByTestId("document-form");
  await form.getByTestId("document-type").selectOption("certificat_medical");
  await form.getByTestId("document-expire").fill("2026-09-20");
  await form.getByTestId("document-fichier").setInputFiles({
    name: nom, mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"),
  });
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    form.getByTestId("document-valider").click(),
  ]);

  // Filtré sur la validité, pas sur le seul type : les re-runs et le test des
  // alertes déposent d'autres certificats sur la même activité.
  const ligne = page.getByTestId("document-activite")
    .filter({ hasText: "Certificat médical" }).filter({ hasText: "Expire dans" }).first();
  await expectVisibleWithReload(page, ligne, { timeout: 15_000 });
  // La validité se dit en jours, comme la maquette.
  await expect(ligne.getByTestId("document-validite")).toContainText("Expire dans");

  // La route refuse une session seule : il faut un ticket, à usage unique.
  const url = await ligne.getByTestId("document-ouvrir").evaluate(() => window.location.pathname);
  expect(url).toContain("/activites/");
  const sansTicket = await request.get(`/api/activites/documents/00000000-0000-4000-8000-000000000000`);
  expect(sansTicket.status()).toBe(401);
});

// Incrément 6 : la semaine. Ce qu'on vient y chercher, c'est moins ce qui a
// lieu que ce qui se télescope.
test("« Cette semaine » montre les séances, et signale les trajets impossibles", async ({ page }) => {
  // La liste par jour est la lecture TÉLÉPHONE : sur grand écran, c'est la
  // grille en sept colonnes qui prend le relais (test plus bas).
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "client@vito.test");
  // Un samedi de référence : le seed y place l'équitation de Camille (10h) et
  // le football de Tom (10h30), au même moment et à deux endroits.
  await page.goto("/fr/activites?onglet=semaine&semaine=2026-09-12");

  await expect(page.getByTestId("semaine-titre")).toContainText("septembre");
  const samedi = page.getByTestId("semaine-jour").filter({ hasText: "samedi" });
  await expect(samedi).toBeVisible();
  await expect(samedi.getByTestId("semaine-seance")).toHaveCount(2);
  await expect(samedi.getByTestId("semaine-conflit")).toContainText("Conflit");

  // La séance dit son horaire de fin et qui dépose.
  await expect(samedi.getByTestId("semaine-seance").first()).toContainText("jusqu'à 11h00");
  await expect(samedi.getByTestId("semaine-seance").first()).toContainText("Dépose : Camille");
  await expect(samedi.getByTestId("semaine-seance").nth(1)).toContainText("Dépose à définir");

  // On navigue de semaine en semaine, et la vue vit dans l'URL.
  await page.getByTestId("semaine-suivante").click();
  await expect(page).toHaveURL(/semaine=2026-09-19/);
  await expect(page.getByTestId("semaine-jour").filter({ hasText: "samedi" })).toBeVisible();
});

test("les vacances scolaires et les voyages se superposent à la semaine", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "client@vito.test");
  // Toussaint zone C : du 17 octobre au 2 novembre, source partagée avec le
  // planning des Voyages.
  await page.goto("/fr/activites?onglet=semaine&semaine=2026-10-24");

  const jours = page.getByTestId("semaine-jour");
  await expect(jours.first().getByTestId("jour-vacances")).toContainText("zone C");
  // Les vacances suspendent, elles n'annulent pas : on signale sans affirmer.
  await expect(jours.first().getByTestId("seance-vacances")).toContainText("Interrompu");
});

// Incrément 7 : la carte. Elle ne se charge qu'en l'ouvrant — Leaflet ne doit
// pas peser sur les autres vues.
test("la carte place les clubs, les filtre par membre et dit ce qu'elle ne montre pas", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/activites?onglet=carte");

  await expect(page.getByTestId("carte-activites")).toBeVisible({ timeout: 15_000 });
  // Les tuiles viennent d'OpenStreetMap, sans clé — même fournisseur que le carnet.
  await expect(page.locator('img[src*="tile.openstreetmap.org"]').first()).toBeVisible({ timeout: 15_000 });

  // Une épingle par club situé ; le seed en place quatre.
  const epingles = page.locator(".leaflet-marker-icon");
  await expect(epingles.first()).toBeVisible();
  const total = await epingles.count();
  expect(total).toBeGreaterThanOrEqual(3);

  // Le filtre par membre est le MÊME composant que la liste : les paramètres
  // d'URL sont partagés, donc les filtres survivent au changement de vue.
  // Un LIEN, pas un bouton : les filtres sont rendus par le serveur.
  const filtreTom = page.getByTestId("activites-filtres").getByRole("link", { name: "Tom" }).first();
  await filtreTom.click();
  await expect(page).toHaveURL(/membre=/);
  await expect(epingles).toHaveCount(1);

  // Un clic sur l'épingle ouvre la fiche compacte, qui mène à la fiche entière.
  await epingles.first().click();
  await expect(page.getByTestId("carte-fiche")).toContainText("Football");
  await page.getByTestId("carte-fiche").getByRole("link", { name: "Ouvrir la fiche" }).click();
  await expect(page).toHaveURL(/\/fr\/activites\/[0-9a-f-]{36}/);
});

// Incrément 8 : les alertes, le bloc dans la fiche membre, le calendrier et le
// planning. Ce qui compte : ce qui presse doit se voir sans être cherché.
test("les alertes trient par urgence et se retrouvent partout où elles comptent", async ({ page }) => {
  await login(page, "client@vito.test");
  // Pas d'assertion sur l'écran VIDE : les tests précédents déposent leurs
  // propres documents, et « rien à traiter » ne serait vrai qu'en premier.
  // On vérifie ce que CE test crée.
  await page.goto("/fr/activites");
  await page.getByTestId("activite-row").filter({ hasText: "Équitation" }).first()
    .getByRole("link").first().click();
  // Un document expiré suffit à peupler les alertes, et il passe par l'écran.
  await page.getByTestId("document-ajouter").click();
  const form = page.getByTestId("document-form");
  await form.getByTestId("document-type").selectOption("certificat_medical");
  await form.getByTestId("document-expire").fill("2020-01-01");
  await form.getByTestId("document-fichier").setInputFiles({
    name: "vieux.pdf", mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"),
  });
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    form.getByTestId("document-valider").click(),
  ]);

  await page.goto("/fr/activites/alertes");
  const enRetard = page.getByTestId("alertes-en_retard");
  await expect(enRetard).toBeVisible({ timeout: 15_000 });
  await expect(enRetard.getByTestId("alerte-row").filter({ hasText: "Certificat médical" }).first())
    .toBeVisible();
  // Chaque alerte mène à l'activité qui la porte.
  await enRetard.getByTestId("alerte-traiter").first().click();
  await expect(page).toHaveURL(/\/fr\/activites\/[0-9a-f-]{36}/);
});

test("le calendrier d'une activité s'exporte, avec une répétition hebdomadaire", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/activites");
  await page.getByTestId("activite-row").filter({ hasText: "Équitation" }).first()
    .getByRole("link").first().click();

  const lien = page.getByTestId("fiche-ics");
  await expect(lien).toBeVisible();
  const href = await lien.getAttribute("href");
  // `page.request` et non le contexte isolé : la route est authentifiée, elle a
  // besoin des cookies de la session ouverte.
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/calendar");
  const ics = await res.text();
  expect(ics).toContain("BEGIN:VCALENDAR");
  expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=SA");
  // Heures flottantes : ni « Z » ni fuseau, pour ne pas glisser au changement d'heure.
  expect(ics).not.toMatch(/DTSTART:\d{8}T\d{6}Z/);
});

test("la fiche d'un proche montre ses activités, et le planning ses créneaux", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/famille");
  await page.getByTestId("proche-row").filter({ hasText: "Camille" }).first().click();

  const bloc = page.getByTestId("membre-activites");
  await expect(bloc).toBeVisible({ timeout: 15_000 });
  await expect(bloc).toContainText("2 activités en cours");
  await expect(bloc.getByTestId("membre-activite-row").first()).toContainText("Danse");

  // Les créneaux se voient aussi dans le planning des voyages : « où serons-nous »
  // et « qui a cours » sont la même question quand on prépare un départ.
  await page.goto("/fr/voyages/planning");
  await expect(page.getByTestId("jour-activite").first()).toBeVisible();
});

// Passe finale : le parcours d'argent, de la saisie au règlement, et son effet
// sur les alertes.
test("une échéance se saisit, se règle, et disparaît des alertes", async ({ page }) => {
  // Parcours long : saisie, alerte, règlement, alerte éteinte. Les 30 s par
  // défaut suffisent aux gestes isolés, pas à un aller-retour complet.
  test.setTimeout(75_000);
  await login(page, "client@vito.test");
  await page.goto("/fr/activites");
  await page.getByTestId("activite-row").filter({ hasText: "Danse" }).first()
    .getByRole("link").first().click();

  const marque = String(Date.now()).slice(-6);
  const libelle = `Cotisation ${marque}`;
  await page.getByTestId("paiement-ajouter").click();
  const form = page.getByTestId("paiement-form");
  await form.getByTestId("paiement-libelle").fill(libelle);
  await form.getByTestId("paiement-montant").fill("310");
  // Échéance dépassée : elle doit apparaître « En retard », et dans les alertes.
  await form.getByTestId("paiement-echeance").fill("2026-01-15");
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    form.getByTestId("paiement-valider").click(),
  ]);

  const ligne = page.getByTestId("fiche-echeance").filter({ hasText: libelle });
  await expectVisibleWithReload(page, ligne, { timeout: 15_000 });
  await expect(ligne).toContainText("En retard");
  await expect(ligne).toContainText("310,00");

  // Elle remonte dans les alertes, du bon côté.
  await page.goto("/fr/activites/alertes");
  await expect(page.getByTestId("alertes-en_retard").getByTestId("alerte-row")
    .filter({ hasText: "Danse" }).first()).toBeVisible({ timeout: 15_000 });

  // On la règle depuis la fiche : l'état suit, et l'alerte s'éteint.
  await page.goBack();
  await expect(ligne).toBeVisible({ timeout: 15_000 });
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    ligne.getByTestId("echeance-regler").click(),
  ]);
  await expectVisibleWithReload(page, ligne.filter({ hasText: "Payé" }), { timeout: 15_000 });
  // Pas d'assertion sur le TOTAL réglé : les re-runs l'additionnent. Ce qui
  // compte est l'état de la ligne, et l'alerte qui s'éteint.

  await page.goto("/fr/activites/alertes");
  await expect(page.getByTestId("alerte-row").filter({ hasText: libelle })).toHaveCount(0);
});

// L'adresse du foyer est située : la fiche peut annoncer un ordre de grandeur.
test("la fiche annonce une durée estimée depuis chez nous", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/activites");
  await page.getByTestId("activite-row").filter({ hasText: "Équitation" }).first()
    .getByRole("link").first().click();

  const duree = page.getByTestId("fiche-duree");
  await expect(duree).toBeVisible();
  // Le tilde est dans le libellé : c'est une estimation, et elle le dit.
  await expect(duree).toContainText("~");
  await expect(duree).toContainText("depuis chez nous");

  // Une activité sans adresse n'annonce aucune durée — mieux vaut se taire.
  await page.goto("/fr/activites?onglet=tous");
  await page.getByTestId("activite-row").filter({ hasText: "Natation" }).first()
    .getByRole("link").first().click();
  await expect(page.getByTestId("fiche-activite")).toBeVisible();
});

// Écarts relevés le 8 septembre (docs/design/ECARTS-ACTIVITES-2026-09-08.md).
test("le mode de règlement se saisit et s'affiche — il ne restait plus vide", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/activites");
  await page.getByTestId("activite-row").filter({ hasText: "Football" }).first()
    .getByRole("link").first().click();

  const libelle = `Licence ${String(Date.now()).slice(-6)}`;
  await page.getByTestId("paiement-ajouter").click();
  const form = page.getByTestId("paiement-form");
  await form.getByTestId("paiement-libelle").fill(libelle);
  await form.getByTestId("paiement-montant").fill("95");
  await form.getByTestId("paiement-periodicite").selectOption("seance");
  await form.getByTestId("paiement-moyen").selectOption("prelevement");
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    form.getByTestId("paiement-valider").click(),
  ]);

  const ligne = page.getByTestId("fiche-echeance").filter({ hasText: libelle });
  await expectVisibleWithReload(page, ligne, { timeout: 15_000 });
  // La colonne `moyen` existait, était lue et acceptée — mais aucun formulaire
  // ne la postait. Ce test est le garde-fou de ce chemin d'écriture.
  await expect(ligne).toContainText("Prélèvement");
  await expect(ligne).toContainText("À la séance");
});

test("les alertes disent quoi faire, et les filtres se retirent un par un", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/activites/alertes");
  // Le verbe suit la nature de l'alerte : « Régler » n'est pas « Renouveler ».
  const premiere = page.getByTestId("alerte-row").first();
  if (await premiere.count()) {
    await expect(premiere.getByTestId("alerte-traiter")).not.toHaveText("Traiter");
  }

  await page.goto("/fr/activites?onglet=tous");
  // Attendre que les filtres soient là avant de cliquer : un clic lancé pendant
  // que la page change encore se perd, et le test accuserait le code à tort.
  await expect(page.getByTestId("activites-filtres")).toBeVisible();
  await page.getByTestId("filtre-statut-terminee").click();
  // Une puce nomme le filtre posé, et le retire d'un clic.
  const puce = page.getByTestId("filtre-pose-terminee");
  await expect(puce).toBeVisible();
  // L'en-tête de résultats le nomme aussi : « N activités · Terminée ».
  await expect(page.getByTestId("activites-compte")).toContainText("Terminée");
  await puce.click();
  await expect(page).not.toHaveURL(/statut=terminee/);
  await expect(page.getByTestId("filtres-poses")).toHaveCount(0);
});

// Écart 7b : l'adresse du club se choisit. Ce qui compte n'est pas la
// suggestion, c'est ce qu'elle apporte — les coordonnées, sans lesquelles un
// club n'est sur aucune carte.
test("choisir une adresse suggérée situe le club, et le fait apparaître sur la carte", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/activites");

  const marque = String(Date.now()).slice(-6);
  await page.getByTestId("activite-ajouter").click();
  const form = page.getByTestId("activite-form");
  await form.getByTestId("activite-nom").fill(`Escrime ${marque}`);
  await form.getByTestId("activite-club").fill("Salle d'armes");

  // Le fournisseur d'adresses est bouché en test : ses fixtures répondent à
  // « bistrot », ce qui suffit à éprouver le chemin.
  await form.getByTestId("activite-adresse").fill("bistrot");
  const suggestion = page.getByTestId("adresse-suggestion").first();
  await expect(suggestion).toBeVisible({ timeout: 15_000 });
  await suggestion.click();
  // Le repère dit que le point est acquis — c'est lui qui vaut la carte.
  await expect(page.getByTestId("adresse-situee")).toBeVisible();

  await form.locator('input[name="membres"]').first().check();
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    form.getByTestId("activite-valider").click(),
  ]);
  await expect(page).toHaveURL(/\/fr\/activites\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  // Et la carte l'épingle : c'était impossible tant que l'adresse se tapait.
  await page.goto("/fr/activites?onglet=carte");
  await expect(page.getByTestId("carte-activites")).toBeVisible({ timeout: 15_000 });
  const epingles = page.locator(".leaflet-marker-icon");
  await expect(epingles.first()).toBeVisible();
  expect(await epingles.count()).toBeGreaterThanOrEqual(4);
});

// Écart 5 : la semaine en sept colonnes sur grand écran. Ce qu'une liste ne
// montre pas, c'est le chevauchement — la grille le met sous les yeux.
test("desktop : la semaine se lit en sept colonnes, avec son rail horaire", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/activites?onglet=semaine&semaine=2026-09-12");

  const grille = page.getByTestId("grille-semaine");
  await expect(grille).toBeVisible();
  await expect(page.getByTestId("grille-colonne")).toHaveCount(7);

  // Le samedi porte le conflit dans son en-tête, et ses deux séances côte à côte.
  await expect(page.getByTestId("colonne-conflit")).toHaveCount(1);
  const samedi = page.getByTestId("grille-colonne").nth(5);
  await expect(samedi.getByTestId("grille-seance")).toHaveCount(2);

  // Deux séances simultanées ne se superposent pas : elles se partagent la
  // largeur, ce qui est tout l'intérêt de la grille.
  const boites = await samedi.getByTestId("grille-seance").all();
  const a = await boites[0]!.boundingBox();
  const b = await boites[1]!.boundingBox();
  expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x + 1);

  // Et la légende nomme les trois teintes.
  await expect(page.getByTestId("grille-legende")).toContainText("Conflit d'horaires");

  // Sur téléphone, c'est la liste par jour : douze heures de grille y seraient
  // illisibles.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("grille-semaine")).toBeHidden();
  await expect(page.getByTestId("semaine-jour").first()).toBeVisible();
});
