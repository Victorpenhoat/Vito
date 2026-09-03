import { test, expect } from "@playwright/test";
import { expectVisibleWithReload, login } from "./helpers";

// Données du compte et administration (design Onboarding écran 16 et « Comptes »).

test("exporter ses données renvoie une archive JSON complète", async ({ page }) => {
  await login(page);
  await page.goto("/fr/reglages");
  await expect(page.getByTestId("exporter-donnees")).toBeVisible();

  const resp = await page.request.get("/api/compte/export");
  expect(resp.status()).toBe(200);
  expect(resp.headers()["content-disposition"]).toContain("vito-mes-donnees");
  const archive = JSON.parse(await resp.text()) as Record<string, unknown>;
  // le compte et ses contenus sont là…
  expect(archive.compte).toBeTruthy();
  expect(Array.isArray(archive.liste_items)).toBe(true);
  expect(Array.isArray(archive.vins)).toBe(true);
  // …et l'archive dit ce qu'elle ne contient pas
  expect(String(archive.note)).toContain("chiffr");
  // aucun scan ni étiquette (données chiffrées) ne doit fuiter dans l'archive
  expect(await resp.text()).not.toContain("contenu_chiffre");
});

test("l'export exige une session", async ({ request }) => {
  const resp = await request.get("/api/compte/export");
  expect(resp.status()).toBe(401);
});

test("la suppression se fait en trois étapes et reste annulable", async ({ page }) => {
  // Parcours long : annulation éventuelle, trois étapes, deux vérifications de
  // mot de passe (chacune interroge le serveur d'auth) et reload-guards.
  test.setTimeout(120_000);
  await login(page, "free@vito.test");
  await page.goto("/fr/reglages");

  // La base est partagée : un run précédent peut avoir laissé une demande en
  // cours. On repart d'un compte sans demande.
  const dejaDemande = page.getByTestId("annuler-suppression");
  if (await dejaDemande.count()) {
    await dejaDemande.click();
    // reload-guard : comme après toute action, le rafraîchissement RSC peut ne
    // pas se commettre (race #71/#77).
    await expectVisibleWithReload(page, page.getByTestId("donnees-section"), { timeout: 20_000 });
  }

  await page.getByTestId("commencer-suppression").click();
  // étape 1 : inventaire de ce qui part
  await expect(page.getByTestId("suppression-etape-1")).toBeVisible();
  await expect(page.getByTestId("suppression-etape-1")).toContainText("Ce qui sera supprimé");

  await page.getByTestId("suppression-suivant").click();
  // étape 2 : délai de rétractation annoncé
  await expect(page.getByTestId("suppression-etape-2")).toContainText("30 jours");

  await page.getByTestId("suppression-suivant-2").click();
  // étape 3 : un mot de passe erroné n'enregistre rien
  await page.getByTestId("suppression-mot-de-passe").fill("mauvais");
  await page.getByTestId("confirmer-suppression").click();
  await expect(page.getByTestId("suppression-etape-3").getByRole("alert")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("suppression-en-cours")).toHaveCount(0);

  // avec le bon mot de passe : la demande est enregistrée, pas exécutée
  await page.getByTestId("suppression-mot-de-passe").fill("password123");
  await page.getByTestId("confirmer-suppression").click();
  // reload-guard : le rafraîchissement RSC post-action peut ne pas se commettre
  // (race documentée #71/#77) — la demande, elle, est bien enregistrée.
  const bandeau = page.getByTestId("suppression-en-cours");
  await expectVisibleWithReload(page, bandeau, { timeout: 20_000 });
  await expect(bandeau).toContainText("effacées définitivement");

  // le compte fonctionne toujours : rien n'a été détruit
  await page.goto("/fr/accueil");
  await expect(page).toHaveURL(/\/fr\/accueil/);

  // annulation (remise en état pour les autres specs)
  await page.goto("/fr/reglages");
  await page.getByTestId("annuler-suppression").click();
  await expectVisibleWithReload(page, page.getByTestId("donnees-section"), { timeout: 20_000 });
});

test("l'écran Comptes est réservé à l'administrateur", async ({ page }) => {
  await login(page);
  await page.goto("/fr/reglages/comptes");
  // requireRole renvoie vers la connexion pour un non-admin
  await expect(page).toHaveURL(/\/fr\/login/);
});

test("l'administrateur gère les accès, et voit qu'il ne voit pas les contenus", async ({ page }) => {
  await login(page, "admin@vito.test");
  await page.goto("/fr/reglages/comptes");
  await expect(page.getByTestId("comptes-avertissement")).toContainText("jamais les contenus");

  const lignes = page.getByTestId("compte-row");
  await expect(lignes.first()).toBeVisible();
  // l'administrateur ne peut pas se suspendre lui-même : sa ligne n'a pas d'action
  const ligneAdmin = lignes.filter({ hasText: "admin@vito.test" });
  await expect(ligneAdmin.getByTestId("compte-suspendre")).toHaveCount(0);

  // suspendre puis réactiver un compte standard
  const cible = lignes.filter({ hasText: "premium@vito.test" }).first();
  await cible.getByTestId("compte-suspendre").click();
  await expect(lignes.filter({ hasText: "premium@vito.test" }).first()).toContainText("Suspendu", { timeout: 20_000 });
  await lignes.filter({ hasText: "premium@vito.test" }).first().getByTestId("compte-reactiver").click();
  await expect(lignes.filter({ hasText: "premium@vito.test" }).first()).not.toContainText("Suspendu", { timeout: 20_000 });
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** En-têtes service role (création/suppression du compte jetable du test). */
function admin() {
  return { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY!}`, "Content-Type": "application/json" };
}

test("un compte suspendu perd l'accès au carnet, sans perdre ses données", async ({ page, browser, request }) => {
  test.skip(!SERVICE_KEY, "SUPABASE_SERVICE_ROLE_KEY absente");

  // Compte jetable : suspendre un compte du seed le laisserait suspendu si le
  // test échouait en cours de route, et empoisonnerait les autres specs.
  const email = `suspendu-${Date.now()}@vito.test`;
  const creation = await request.post(`${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: admin(),
    data: { email, password: "password123", email_confirm: true },
  });
  expect(creation.ok()).toBeTruthy();
  const userId = (await creation.json()).id as string;

  try {
    // le compte accède normalement à son carnet
    const victime = await browser.newContext();
    const pageV = await victime.newPage();
    await login(pageV, email);
    await pageV.goto("/fr/accueil");
    await expect(pageV).toHaveURL(/\/fr\/accueil/);

    // un administrateur suspend cet accès depuis l'écran Comptes
    await login(page, "admin@vito.test");
    await page.goto("/fr/reglages/comptes");
    const ligne = page.getByTestId("compte-row").filter({ hasText: email }).first();
    await ligne.getByTestId("compte-suspendre").click();
    await expect(page.getByTestId("compte-row").filter({ hasText: email }).first())
      .toContainText("Suspendu", { timeout: 20_000 });

    // l'accès est coupé : sessions révoquées côté serveur, et garde d'affichage
    await pageV.goto("/fr/accueil");
    await expect
      .poll(async () => (await pageV.getByTestId("compte-suspendu").count()) > 0 || /\/login/.test(pageV.url()),
        { timeout: 20_000 })
      .toBe(true);

    // les contenus ne sont pas détruits : le profil existe toujours
    const profil = await request.get(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,suspendu_le`, {
      headers: admin(),
    });
    const lignes = await profil.json();
    expect(lignes).toHaveLength(1);
    expect(lignes[0].suspendu_le).not.toBeNull();

    await victime.close();
  } finally {
    await request.delete(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { headers: admin() });
  }
});
