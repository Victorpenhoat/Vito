import { test, expect } from "@playwright/test";
import { expectCountWithReload, expectVisibleWithReload, login } from "./helpers";

// Hôtels v2 : l'onglet est rendu par la brique générique CategoryTabs
// (sous-onglets ?onglet= URL-driven — navigation par URL, jamais par clic
// d'onglet : le clic peut asserter contre le panneau périmé, cf. Resto v2).

test("l'onglet Hôtels v2 montre l'hôtel à tester seedé", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels?onglet=a_tester");
  await expect(page.getByTestId("hotels-tabs")).toBeVisible();
  await expect(page.getByTestId("place-card").filter({ hasText: "Hôtel Démo" }).first()).toBeVisible();
});

test("l'hôtel n'apparaît PAS dans Restos (getPlaces resto exclut les hôtels)", async ({ page }) => {
  await login(page);
  await page.goto("/fr/restos?onglet=tous");
  await expect(page.getByTestId("restos-tabs")).toBeVisible();
  await expect(page.getByTestId("places-panel")).toBeVisible();
  await expect(page.getByTestId("place-card").filter({ hasText: "Hôtel Démo" })).toHaveCount(0);
});

test("Séjours : le séjour seedé (Hôtel Démo 2) est listé avec sa note", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels?onglet=sejours");
  const row = page.getByTestId("place-card").filter({ hasText: "Hôtel Démo 2" }).first();
  await expectVisibleWithReload(page, row);
  // RowExtras : dernier séjour (date + note /10) + « Passer en favori »
  await expect(page.getByText("séjour le 2026-09-12")).toBeVisible();
  await expect(page.getByTestId("passer-favori").first()).toBeVisible();
});

test("ajouter un hôtel via la recherche externe (statut du sous-onglet)", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels?onglet=a_tester");
  await page.getByTestId("trouver-hotel").click();
  // Idempotent (recette #72/Resto v2) : si un run précédent l'a déjà ajouté, il
  // remonte en « Déjà dans Vito » avec un chip statut (result-added) sans bouton.
  await page.getByTestId("add-hotel-search").fill("hôtel");
  await page.getByTestId("search-submit").click();
  const voyageurs = page.getByTestId("search-result").filter({ hasText: "Hôtel des Voyageurs" }).first();
  await expect(voyageurs).toBeVisible();
  if ((await voyageurs.getByTestId("result-added").count()) === 0) {
    // 2 boutons par ligne externe (+ statut / ▾) → .first() = ajout au statut du sous-onglet
    await voyageurs.getByRole("button").first().click();
  }
  await expect(voyageurs.getByTestId("result-added")).toBeVisible({ timeout: 15_000 });
  // Ajouté depuis « À tester » → il apparaît dans ce sous-onglet
  await page.goto("/fr/hotels?onglet=a_tester");
  await expectVisibleWithReload(page, page.getByTestId("place-card").filter({ hasText: "Hôtel des Voyageurs" }).first());
});

test("recherche externe hôtel : chips « Explorer par envie »", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels");
  await page.getByTestId("trouver-hotel").click();
  await expect(page.getByTestId("envies")).toBeVisible();
  await expect(page.getByTestId("envie-envieSpa")).toBeVisible();
});

test("liste hôtel : filtre par tag (Spa)", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels?onglet=a_tester");
  await expect(page.getByTestId("list-tag-filter")).toBeVisible();
  // ≥ 1 hôtel à tester (Hôtel Démo [spa] ; le test d'ajout peut en ajouter en
  // base partagée → on capture le total plutôt qu'un compte absolu).
  const total = await page.getByTestId("place-card").count();
  expect(total).toBeGreaterThanOrEqual(1);
  await page.getByTestId("list-tag-spa").click();
  await expect(page.getByTestId("place-card")).toHaveCount(1);
  await page.getByTestId("list-tag-tous").click();
  await expect(page.getByTestId("place-card")).toHaveCount(total);
});

// Fiches seedées (ids stables du seed) — la navigation directe évite de dépendre
// de l'ordre des listes.
const HOTEL_DEMO = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa";      // à tester, tag spa, équipements
const HOTEL_DEMO_2 = "22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa";    // séjour seedé lié au voyage Rome

test("fiche hôtel v2 : statut, équipements fournisseur, infos perso, réservation", async ({ page }) => {
  await login(page);
  await page.goto(`/fr/hotels/${HOTEL_DEMO}`);
  await expect(page.getByTestId("statut-chip")).toBeVisible();
  // équipements = données fournisseur (✓ petit-déjeuner / ✗ parking dans le seed)
  await expect(page.getByTestId("equipements-block")).toBeVisible();
  // infos saisies par moi (étoiles / prix / check-in / check-out)
  await expect(page.getByTestId("infos-hotel-form")).toBeVisible();
  await expect(page.getByTestId("lien-booking")).toBeVisible();
  // l'origine est proposée sur les hôtels comme sur les restos
  await expect(page.getByTestId("origine-block")).toBeVisible();
});

test("séjour : dates arrivée→départ, voyage détecté, enregistrement", async ({ page }) => {
  await login(page);
  await page.goto(`/fr/hotels/${HOTEL_DEMO_2}`);
  const lignes = page.getByTestId("sejour-row");
  const avant = await lignes.count();

  await page.getByTestId("visite-cta").click();
  const form = page.getByTestId("sejour-form");
  await expect(form).toBeVisible();
  // le voyage « Week-end à Rome » du seed couvre 2026-09-12 → 2026-09-15
  await form.locator('input[name="visiteLe"]').fill("2026-09-12");
  await form.locator('input[name="dateFin"]').fill("2026-09-15");
  await expect(page.getByTestId("sejour-nuits")).toHaveText(/3/);
  await expect(page.getByTestId("voyage-lie")).toContainText("Rome");

  // signal serveur déterministe (recette repo) plutôt qu'un toBeEnabled post-action
  const reponse = page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400);
  await form.getByRole("button", { name: "Enregistrer le séjour" }).click();
  await reponse;

  // compte RELATIF (la base est partagée entre retries) : un séjour de plus.
  // reload-guard : le refresh RSC post-action peut ne jamais se commettre sous
  // charge (race #71/#77) — rendu frais depuis la base au besoin.
  await expectCountWithReload(page, lignes, avant + 1, { timeout: 15_000 });
  await expect(page.getByTestId("sejour-voyage").first()).toBeVisible();
});

test("carte hôtels : légende par statut et compteur", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels?onglet=carte");
  await expect(page.getByTestId("map-legend")).toBeVisible();
  await expect(page.getByTestId("map-count")).toBeVisible();
});

// Lot H4 : dates + occupation de la recherche. Rien n'est envoyé au
// fournisseur (Google Places New n'en veut pas) — le contexte sert à
// préremplir le séjour, et c'est ce report que ce test vérifie.
const jourDans = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

test("recherche hôtel : les dates et l'occupation choisies préremplissent le séjour", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels?onglet=a_tester");
  await page.getByTestId("trouver-hotel").click();

  const arrivee = jourDans(10);
  const depart = jourDans(13);

  await page.getByTestId("chip-dates").click();
  await page.getByTestId(`jour-${arrivee}`).click();
  await page.getByTestId(`jour-${depart}`).click();
  await expect(page.getByTestId("contexte-nuits")).toContainText("3");
  await page.getByTestId("contexte-appliquer").click();

  // occupation : un adulte de plus, une chambre de plus
  await page.getByTestId("chip-occupation").click();
  await page.getByTestId("adultes-plus").click();
  await page.getByTestId("chambres-plus").click();
  await expect(page.getByTestId("compte-adultes")).toHaveText("3");
  await page.getByTestId("contexte-appliquer").click();
  await expect(page.getByTestId("chip-occupation")).toContainText("3 ad.");

  // le formulaire de séjour reprend tout, et l'annonce
  await page.goto(`/fr/hotels/${HOTEL_DEMO}`);
  await page.getByTestId("visite-cta").click();
  const form = page.getByTestId("sejour-form");
  await expect(form).toBeVisible();
  await expect(page.getByTestId("contexte-repris")).toBeVisible();
  await expect(form.locator('input[name="visiteLe"]')).toHaveValue(arrivee);
  await expect(form.locator('input[name="dateFin"]')).toHaveValue(depart);
  await expect(form.getByTestId("occupation-adultes")).toHaveValue("3");
  await expect(form.getByTestId("occupation-chambres")).toHaveValue("2");
});

test("les restaurants ignorent le contexte de séjour (brique générique paramétrée)", async ({ page }) => {
  await login(page);
  await page.goto("/fr/restos?onglet=a_tester");
  await page.getByTestId("trouver-restaurant").click();
  await expect(page.getByTestId("add-resto-search")).toBeVisible();
  await expect(page.getByTestId("sejour-contexte")).toHaveCount(0);
});

// Lot H5 : les hôtels s'éparpillent sur plusieurs pays — dézoomés, leurs
// marqueurs se regroupent. Les deux hôtels du seed sont à ~1 km l'un de
// l'autre : au cadrage d'ouverture, ils ne font qu'une pastille.
test("carte hôtels : les marqueurs se regroupent, et la pastille éclate au clic", async ({ page }) => {
  await login(page);
  await page.goto("/fr/hotels?onglet=carte");
  await expect(page.getByTestId("places-map")).toBeVisible({ timeout: 15_000 });

  const pastille = page.getByTestId("cluster-pastille").first();
  await expect(pastille).toBeVisible({ timeout: 15_000 });
  await expect(pastille).toContainText("Paris");
  const nb = Number(await pastille.getAttribute("data-nb"));
  expect(nb).toBeGreaterThanOrEqual(2);

  // le clic zoome jusqu'à séparer le groupe : les épingles individuelles sortent
  await pastille.click();
  await expect(page.getByTestId("cluster-pastille")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(nb);

  // le compteur décrit alors ce que la carte montre
  await expect(page.getByTestId("map-count")).toContainText("zone visible");
});

test("carte restos : pas de regroupement (config map.clusters = false)", async ({ page }) => {
  await login(page);
  await page.goto("/fr/restos?onglet=carte");
  await expect(page.getByTestId("places-map")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("cluster-pastille")).toHaveCount(0);
  // le compteur restos reste celui du filtre, pas celui du cadrage
  await expect(page.getByTestId("map-count")).not.toContainText("zone visible");
});
