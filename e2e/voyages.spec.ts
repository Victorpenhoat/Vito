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
