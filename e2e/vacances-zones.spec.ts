import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Le planning ne lit plus une liste écrite à la main pour une seule zone et
// une seule année scolaire : il lit le calendrier du ministère, mis en cache,
// pour la zone du FOYER. Ces tests éprouvent la chaîne entière — adresse →
// zone → cache → bandes — et l'interrupteur qui révèle les zones voisines.
//
// Aucun appel au ministère : le seed préremplit `vacances_scolaires`. Lier la
// CI à la disponibilité d'un site tiers donnerait des builds rouges qui
// n'apprennent rien.

test("le planning suit la zone du foyer, et l'interrupteur révèle les deux autres", async ({ page }) => {
  await login(page);
  await page.goto("/fr/voyages/planning");

  // Bordeaux, 33000 : Zone A, déduite de l'adresse de la fiche « Moi » — aucun
  // choix explicite n'a été fait dans les Réglages.
  await expect(page.getByTestId("planning-zone")).toContainText("Zone A");

  // La frise de douze mois est la vue « Année » : c'est là que se lisent les
  // pistes de zones.
  await page.getByTestId("vue-annee").click();
  await expect(page.getByTestId("planning-frise")).toBeVisible();
  // Le calendrier est bien arrivé jusqu'à l'écran : sans lui, la frise le dit
  // au lieu de rester muette.
  await expect(page.getByTestId("planning-sans-vacances")).toHaveCount(0);
  expect(await page.getByTestId("planning-vacances").count()).toBeGreaterThan(0);

  // Par défaut, une seule zone : c'est la décision PO.
  await expect(page.getByTestId("piste-zone-autre")).toHaveCount(0);

  await page.getByTestId("autres-zones").check();
  await expect(page.getByTestId("piste-zone-autre")).toHaveCount(2);

  // Le calendrier mensuel les montre aussi, en pastilles pâles : octobre 2026
  // porte la Toussaint, commune aux trois zones.
  await page.getByTestId("vue-mois").click();
  await page.getByTestId("mois-suivant").click();
  await expect(page.getByTestId("planning-mois-titre")).toContainText("octobre");
  expect(await page.getByTestId("pastille-zone-autre").count()).toBeGreaterThan(0);
  await page.getByTestId("vue-annee").click();

  // La mémoire de l'interrupteur est tout l'intérêt du cookie — et le cookie,
  // tout l'intérêt du rendu serveur : après rechargement, la case est déjà
  // cochée et les bandes déjà dessinées, sans clignotement d'hydratation.
  await page.reload();
  await expect(page.getByTestId("autres-zones")).toBeChecked();
  await page.getByTestId("vue-annee").click();
  await expect(page.getByTestId("piste-zone-autre")).toHaveCount(2);

  // Et il s'éteint aussi bien qu'il s'allume.
  await page.getByTestId("autres-zones").uncheck();
  await expect(page.getByTestId("piste-zone-autre")).toHaveCount(0);
});

test("sans zone voisine, l'interrupteur n'est pas proposé", async ({ page }) => {
  // Ce compte a « Corse » pour zone enregistrée (seed) : la Corse n'a pas de
  // zone A/B/C à comparer, donc rien à révéler.
  await login(page, "admin@vito.test");
  await page.goto("/fr/voyages/planning");

  await expect(page.getByTestId("planning-zone")).toContainText("Corse");
  await expect(page.getByTestId("autres-zones")).toHaveCount(0);

  // Une zone sans voisine garde son PROPRE calendrier : si celui-ci manquait,
  // la frise le dirait — et c'est aussi la preuve que le cache du seed a
  // servi, sans détour par l'API du ministère.
  await page.getByTestId("vue-annee").click();
  await expect(page.getByTestId("planning-sans-vacances")).toHaveCount(0);
});

test("sans zone du tout, l'écran demande la zone au lieu de se taire", async ({ page }) => {
  // Ce compte n'a ni zone enregistrée ni fiche « Moi » d'où la déduire : un
  // planning silencieux se prendrait pour une panne.
  await login(page, "agence@vito.test");
  await page.goto("/fr/voyages/planning");

  await expect(page.getByTestId("planning-zone")).toHaveCount(0);
  await expect(page.getByTestId("autres-zones")).toHaveCount(0);

  // Les deux vues portent le lien, sous deux identifiants distincts : un
  // testid partagé serait une violation du mode strict le jour où elles
  // seraient rendues ensemble.
  await page.getByTestId("vue-annee").click();
  await expect(page.getByTestId("frise-choisir-zone")).toBeVisible();

  await page.getByTestId("vue-mois").click();
  await page.getByTestId("planning-choisir-zone").click();
  await expect(page).toHaveURL(/\/fr\/reglages/);
});

test("la zone choisie dans les Réglages est celle que le planning suit", async ({ page }) => {
  // L'aller-retour qui porte la fonctionnalité : choisir sa zone, la retrouver
  // sur le planning. admin@vito.test a « Corse » enregistrée (seed) — une zone
  // qu'on peut donc REMETTRE en fin de test, contrairement à client@vito.test
  // dont la zone est seulement déduite et qu'aucun formulaire ne saurait
  // rendre à son état « non choisie ».
  await login(page, "admin@vito.test");

  try {
    await page.goto("/fr/reglages");
    await page.getByTestId("zone-scolaire-select").selectOption("Zone B");
    await page.getByTestId("zone-scolaire-enregistrer").click();
    await expect(page.getByTestId("zone-scolaire-enregistree")).toBeVisible();

    await page.goto("/fr/voyages/planning");
    await expect(page.getByTestId("planning-zone")).toContainText("Zone B");

    // Ce sont bien les périodes de la Zone B, pas celles de la Corse : les
    // deux zones partagent la Toussaint et Noël, mais leur hiver diffère —
    // le 20 février pour la Zone B, le 13 pour la Corse (seed).
    const hiver = page.getByTestId("periode-scolaire").filter({ hasText: "Vacances d'Hiver" });
    await expect(hiver).toHaveCount(1);
    await expect(hiver).toContainText("20 févr.");

    // Et la Zone B a deux voisines, là où la Corse n'en avait aucune : le
    // planning a suivi le choix jusque dans ce qu'il propose.
    await expect(page.getByTestId("autres-zones")).toBeVisible();
  } finally {
    // Restauration : les deux tests ci-dessus attendent « Corse ».
    await page.goto("/fr/reglages");
    await page.getByTestId("zone-scolaire-select").selectOption("Corse");
    await page.getByTestId("zone-scolaire-enregistrer").click();
    await expect(page.getByTestId("zone-scolaire-enregistree")).toBeVisible();
    // Vérifiée en base, pas seulement à l'écran : un rechargement relit le
    // profil, et c'est ce que verra la spec suivante.
    await page.reload();
    await expect(page.getByTestId("zone-scolaire-select")).toHaveValue("Corse");
  }
});
