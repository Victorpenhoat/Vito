import { test, expect } from "@playwright/test";
import { expectVisibleWithReload, login } from "./helpers";

test("créer un voyage, ajouter une réservation, partager avec l'agence", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto("/fr/voyages");

  // Titre unique pour être re-run-safe
  const titre = `Voyage E2E Lisbonne ${Date.now()}`;
  await page.getByTestId("voyage-form").locator('input[name="titre"]').fill(titre);
  await page.getByTestId("voyage-form").getByRole("button").click();

  // Le voyage apparaît dans la liste — refonte Lot A : la liste est filtrée par
  // sous-onglets ; un voyage créé sans statut explicite naît « En préparation ».
  await page.getByRole("button", { name: "En préparation" }).click();
  await expectVisibleWithReload(page, page.getByTestId("voyage-card").filter({ hasText: "Lisbonne" }).first());

  // Ouvrir le voyage (cliquer sur le lien dans la card)
  await page.getByTestId("voyage-card").filter({ hasText: "Lisbonne" }).first().getByRole("link").click();
  await expect(page).toHaveURL(/\/fr\/voyages\//);

  // Ajouter une réservation hôtel
  await page.getByTestId("reservation-form").locator('select[name="type"]').selectOption("hotel");
  await page.getByTestId("reservation-form").locator('input[name="fournisseur"]').fill("Hotel Lisboa");
  // Le formulaire porte deux boutons depuis le lot H6 (rechercher un hébergement,
  // et enregistrer) : on vise l'envoi, pas « le » bouton.
  await page.getByTestId("reservation-form").locator('button[type="submit"]').click();
  await expectVisibleWithReload(page, page.getByTestId("reservation-row").filter({ hasText: "Hotel Lisboa" }));

  // Partager avec l'agence
  await page.getByTestId("share-form").locator('input[name="email"]').fill("agence@vito.test");
  await page.getByTestId("share-form").getByRole("button").click();

  // Un member-row pour l'agence doit apparaître (en plus du owner)
  await expectVisibleWithReload(
    page,
    page
      .getByTestId("member-row")
      .filter({ hasText: "agence" })
      .or(page.getByTestId("member-row").nth(1)),
  );
});

test("l'agence voit le voyage partagé par le seed", async ({ page }) => {
  await login(page, "agence@vito.test");
  await page.goto("/fr/voyages");
  // Le seed partage « Week-end à Rome » (owner=client) avec l'agence
  await expect(page.getByTestId("voyage-card").filter({ hasText: "Rome" })).toBeVisible();
});

// Lot B : qui part (voyageurs) et quoi faire sur place (programme). Le voyage
// « Week-end à Rome » du seed appartient au client et court du 12 au 15
// septembre 2026 — quatre jours au programme.
const VOYAGE_ROME = "11111111-2222-4333-8444-555555555555";

test("les voyageurs : un proche du Cercle, un invité libre, et le retrait", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto(`/fr/voyages/${VOYAGE_ROME}`);

  const invite = `Invité E2E ${Date.now()}`;
  await page.getByTestId("participant-ajouter").click();
  const form = page.getByTestId("participant-form");
  await expect(form).toBeVisible();

  // le Cercle du client (Camille Durand) est proposé — sauf s'il est déjà du voyage
  const camille = form.getByTestId("participant-proche").filter({ hasText: "Camille" });
  if ((await camille.count()) > 0) {
    await camille.first().click();
    await expectVisibleWithReload(page, page.getByTestId("participant-row").filter({ hasText: "Camille" }).first());
    await page.getByTestId("participant-ajouter").click();
  }

  // quelqu'un qui n'a ni compte ni fiche : saisi librement
  await page.getByTestId("participant-nom").fill(invite);
  await page.getByTestId("participant-valider").click();
  const ligne = page.getByTestId("participant-row").filter({ hasText: invite });
  await expectVisibleWithReload(page, ligne, { timeout: 15_000 });
  await expect(ligne).toContainText("invité");

  // le retrait ne laisse rien derrière
  await ligne.getByTestId("participant-retirer").click();
  await expect(ligne).toHaveCount(0, { timeout: 15_000 });
});

test("le programme : les jours du voyage, une étape datée et une à caler", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto(`/fr/voyages/${VOYAGE_ROME}`);

  // du 12 au 15 septembre : quatre journées, affichées même vides
  await expect(page.getByTestId("programme-jour")).toHaveCount(4);

  const etape = `Colisée ${Date.now()}`;
  const premierJour = page.getByTestId("programme-jour").first();
  await premierJour.getByTestId("etape-ajouter").click();
  await premierJour.getByTestId("etape-heure").fill("09:30");
  await premierJour.getByTestId("etape-titre").fill(etape);
  await premierJour.getByTestId("etape-valider").click();

  const ligne = page.getByTestId("programme-etape").filter({ hasText: etape });
  await expectVisibleWithReload(page, ligne, { timeout: 15_000 });
  await expect(ligne).toContainText("09:30");

  // une envie sans date : elle attend dans « à caler », elle ne se perd pas
  const envie = `Marché aux puces ${Date.now()}`;
  const aCaler = page.getByTestId("programme-a-caler");
  await aCaler.getByTestId("etape-ajouter").click();
  await aCaler.getByTestId("etape-titre").fill(envie);
  await aCaler.getByTestId("etape-valider").click();
  await expectVisibleWithReload(page, aCaler.getByTestId("programme-etape").filter({ hasText: envie }), { timeout: 15_000 });

  // suppression de l'étape datée
  await page.getByTestId("programme-etape").filter({ hasText: etape }).getByTestId("etape-supprimer").click();
  await expect(page.getByTestId("programme-etape").filter({ hasText: etape })).toHaveCount(0, { timeout: 15_000 });
});

// Lot C : chaque type de réservation a ses champs propres, et son billet se
// dépose là où on le cherche — sous la réservation.
const PDF_BILLET = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

test("un vol porte ses champs, son résumé, et son billet joint", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto(`/fr/voyages/${VOYAGE_ROME}`);

  const form = page.getByTestId("reservation-form");
  await form.locator('select[name="type"]').selectOption("vol");
  // les champs suivent le type : plus de recherche d'hébergement, mais un vol
  await expect(form.getByTestId("hebergement-recherche")).toHaveCount(0);
  await expect(form.getByTestId("details-numero")).toBeVisible();

  const numero = `AF${Date.now() % 100000}`;
  await form.locator('input[name="fournisseur"]').fill("Air France");
  await form.getByTestId("details-numero").fill(numero);
  await form.getByTestId("details-depart").fill("CDG");
  await form.getByTestId("details-arrivee").fill("FCO");
  await form.getByTestId("details-heureDepart").fill("10:15");
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    form.locator('button[type="submit"]').click(),
  ]);

  const ligne = page.getByTestId("reservation-row").filter({ hasText: numero });
  await expectVisibleWithReload(page, ligne, { timeout: 15_000 });
  await expect(ligne.getByTestId("reservation-resume")).toContainText("CDG → FCO");
  await expect(ligne.getByTestId("reservation-resume")).toContainText("10:15");

  // le billet se joint depuis la réservation elle-même
  const billet = `billet-${Date.now()}.pdf`;
  await ligne.getByTestId("voucher-ajouter").click();
  await ligne.getByTestId("voucher-form").locator('input[type="file"]')
    .setInputFiles({ name: billet, mimeType: "application/pdf", buffer: PDF_BILLET });
  await ligne.getByTestId("voucher-deposer").click();
  await expect(ligne.getByTestId("voucher-lien").filter({ hasText: billet })).toBeVisible({ timeout: 15_000 });

  // il reste un document du voyage, mais on voit d'où il vient. Rendu frais
  // demandé explicitement : deux gardes de rechargement d'affilée épuisent le
  // budget de 30 s du test avant d'avoir rien prouvé.
  await page.reload();
  const dansLesDocuments = page.getByTestId("document-row").filter({ hasText: billet });
  await expect(dansLesDocuments).toBeVisible({ timeout: 10_000 });
  await expect(dansLesDocuments.getByTestId("document-rattache")).toContainText("Air France");
});

// Lot D : les dépenses se partagent entre VOYAGEURS, y compris ceux qui n'ont
// pas de compte — c'est là que le lot B prend tout son sens.
test("une dépense partagée entre voyageurs, son solde, puis le remboursement qui l'annule", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto(`/fr/voyages/${VOYAGE_ROME}`);

  // deux voyageurs propres à ce run : les soldes sont alors prévisibles
  const marque = String(Date.now()).slice(-6);
  for (const nom of [`Payeur ${marque}`, `Partageur ${marque}`]) {
    await page.getByTestId("participant-ajouter").click();
    await page.getByTestId("participant-nom").fill(nom);
    await page.getByTestId("participant-valider").click();
    await expect(page.getByTestId("participant-row").filter({ hasText: nom })).toBeVisible({ timeout: 15_000 });
  }

  // Le bloc Dépenses est alimenté par le SERVEUR : il lui faut les identifiants
  // persistés des voyageurs, que l'affichage optimiste de la liste ne lui donne
  // pas. On demande donc un rendu frais avant de partager quoi que ce soit.
  await page.reload();
  await expect(page.getByTestId("depenses-voyage")).toBeVisible({ timeout: 15_000 });

  // 30 € payés par le premier, partagés avec le second seulement
  await page.getByTestId("depense-ajouter").click();
  const form = page.getByTestId("depense-form");
  await form.getByTestId("depense-libelle").fill(`Taxi ${marque}`);
  await form.getByTestId("depense-montant").fill("30");
  await form.getByTestId("depense-paye-par").selectOption({ label: `Payeur ${marque}` });
  // on ne coche que nos deux voyageurs : les autres ne partagent pas ce taxi
  for (const c of await form.locator('input[name="participants"]').all()) {
    const label = await c.getAttribute("aria-label");
    if (label && !label.includes(marque)) await c.uncheck();
  }
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    form.getByTestId("depense-valider").click(),
  ]);

  const ligne = page.getByTestId("depense-row").filter({ hasText: `Taxi ${marque}` });
  await expectVisibleWithReload(page, ligne, { timeout: 15_000 });

  // 15 € dus par le partageur au payeur : le transfert le dit sans détour
  const soldes = page.getByTestId("depenses-soldes");
  await expect(soldes.getByTestId("solde-row").filter({ hasText: `Payeur ${marque}` })).toContainText("15");
  await expect(page.getByTestId("transfert-row").filter({ hasText: `Partageur ${marque}` })).toContainText("15");

  // le remboursement remet les compteurs à zéro
  const remb = page.getByTestId("remboursement-form");
  await remb.getByTestId("remboursement-de").selectOption({ label: `Partageur ${marque}` });
  await remb.getByTestId("remboursement-vers").selectOption({ label: `Payeur ${marque}` });
  await remb.getByTestId("remboursement-montant").fill("15");
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    remb.getByTestId("remboursement-valider").click(),
  ]);

  await page.reload();
  await expect(soldes.getByTestId("solde-row").filter({ hasText: `Payeur ${marque}` })).toContainText("0,00");
  await expect(page.getByTestId("transfert-row").filter({ hasText: marque })).toHaveCount(0);
});
