import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

// Mode voyage hors ligne (design Onboarding_Compte écran 12).
// Deux promesses à éprouver, dont une qui protège :
//   « Vouchers, billets et réservations consultables hors ligne, sans vérification. »
//   « Les documents d'identité restent protégés, même hors ligne. »

const VOYAGE = "11111111-2222-4333-8444-555555555555"; // Week-end à Rome, compte client
const CARNET = `/fr/carnet-hors-ligne/${VOYAGE}`;
// Ce voyage est aussi celui de documents.spec, qui y téléverse ses propres
// pièces : on repère donc les éléments par leur identité, jamais par leur rang.
const VOUCHER = "Voucher Hotel Roma";

/** Le service worker doit avoir pris la main, sinon rien n'est intercepté hors ligne. */
async function serviceWorkerPret(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30_000 });
}

async function emporterLeVoyage(page: Page) {
  await page.goto(`/fr/voyages/${VOYAGE}`);
  await serviceWorkerPret(page);
  await expect(page.getByTestId("mode-voyage")).toBeVisible();
  await page.getByTestId("mode-voyage-telecharger").click();
  // signal déterministe : l'état n'apparaît qu'une fois tout écrit dans le cache
  await expect(page.getByTestId("mode-voyage-etat")).toBeVisible({ timeout: 30_000 });
}

test("le carnet emporté reste consultable sans réseau, sans aucune vérification", async ({ page, context }) => {
  await login(page);
  await emporterLeVoyage(page);

  // On place l'application dans l'état où elle SE VERROUILLERAIT : longue
  // absence. Le verrou se lève au mot de passe, donc en interrogeant le
  // serveur — hors ligne il enfermerait le voyageur dehors. Le carnet doit
  // rester lisible malgré cet état, c'est le sens de « sans vérification ».
  await page.evaluate(() =>
    localStorage.setItem("vito.derniere-activite", String(Date.now() - 10 * 60 * 1000)));

  await context.setOffline(true);
  try {
    await page.goto(CARNET);
    // le voyage, ses réservations et sa pièce jointe, sans réseau ni mot de passe
    await expect(page.getByRole("heading", { name: "Week-end à Rome" })).toBeVisible();
    await expect(page.getByTestId("carnet-reservation").filter({ hasText: "CONF-123" })).toBeVisible();
    await expect(page.getByTestId("carnet-document").filter({ hasText: VOUCHER })).toBeVisible();
    await expect(page.getByTestId("verrou-app")).toHaveCount(0);
  } finally {
    await context.setOffline(false);
  }
});

test("la pièce jointe elle-même est lisible hors ligne", async ({ page, context }) => {
  await login(page);
  await emporterLeVoyage(page);

  await context.setOffline(true);
  try {
    await page.goto(CARNET);
    const image = page.getByTestId("carnet-document").filter({ hasText: VOUCHER }).locator("img");
    // l'image est réellement décodée : elle vient du cache, pas d'un lien mort
    await expect
      .poll(async () => image.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth), { timeout: 20_000 })
      .toBeGreaterThan(0);
  } finally {
    await context.setOffline(false);
  }
});

test("hors ligne, le Cercle ne s'ouvre pas : on retombe sur le carnet", async ({ page, context }) => {
  await login(page);
  await emporterLeVoyage(page);

  await context.setOffline(true);
  try {
    // une page du Cercle demandée sans réseau ne doit RIEN livrer de protégé
    await page.goto("/fr/famille");
    await expect(page.getByTestId("carnet-identite")).toBeVisible({ timeout: 20_000 });
    const texte = (await page.textContent("body")) ?? "";
    expect(texte).not.toContain("19FR99892"); // numéro de passeport du seed
  } finally {
    await context.setOffline(false);
  }
});

test("retirer le carnet le retire vraiment de l'appareil", async ({ page, context }) => {
  await login(page);
  await emporterLeVoyage(page);

  await page.getByTestId("mode-voyage-retirer").click();
  await expect(page.getByTestId("mode-voyage-telecharger")).toBeVisible();

  await context.setOffline(true);
  try {
    await page.goto(CARNET);
    // plus rien d'emporté : le carnet n'est plus servi
    await expect(page.getByRole("heading", { name: "Week-end à Rome" })).toHaveCount(0);
  } finally {
    await context.setOffline(false);
  }
});
