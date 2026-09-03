import { test, expect } from "@playwright/test";

// Inscription SUR INVITATION (décision PO, design Onboarding écrans 2/5/7/12).
// Jetons fixes du seed : valide, expiré, et invitation à un voyage.

const EXPIREE = "e2e-invitation-expiree-00000000001";
const VOYAGE = "e2e-invitation-voyage-000000000001";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLIENT_ID = "11111111-1111-1111-1111-111111111111";

/**
 * Crée une invitation dédiée au test (jeton unique). Indispensable : un jeton
 * est à usage unique, donc un jeton du seed ne survit ni au second run ni aux
 * retries de Playwright.
 */
async function creerInvitation(
  request: import("@playwright/test").APIRequestContext,
  token: string,
): Promise<boolean> {
  if (!SERVICE_KEY) return false;
  const r = await request.post(`${SUPABASE_URL}/rest/v1/invitations`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    data: { token, role_vise: "membre", cree_par: CLIENT_ID },
  });
  return r.ok();
}


test("une invitation expirée ne dit pas pourquoi elle est refusée", async ({ page }) => {
  await page.goto(`/fr/invitation/${EXPIREE}`);
  await expect(page.getByTestId("invitation-invalide")).toBeVisible();
  // aucun formulaire de création n'apparaît
  await expect(page.getByTestId("creer-compte-tunnel")).toHaveCount(0);
});

test("un jeton inexistant donne exactement le même écran", async ({ page }) => {
  await page.goto("/fr/invitation/jeton-qui-n-existe-pas-du-tout-000");
  await expect(page.getByTestId("invitation-invalide")).toBeVisible();
});

test("une invitation à un voyage annonce le voyage et l'accès limité", async ({ page }) => {
  await page.goto(`/fr/invitation/${VOYAGE}`);
  const accueil = page.getByTestId("invitation-accueil");
  await expect(accueil).toBeVisible();
  await expect(accueil).toContainText("Week-end à Rome");
  await expect(accueil).toContainText("vous n'aurez accès qu'à ce voyage", { ignoreCase: true });
});

test("créer son compte depuis une invitation valide, qui ne sert qu'une fois", async ({ page, request }) => {
  const token = `e2e-invit-${Date.now()}-${Math.floor(Math.random() * 100000)}`.padEnd(24, "0");
  const cree = await creerInvitation(request, token);
  test.skip(!cree, "clé service role absente de l'environnement");

  await page.goto(`/fr/invitation/${token}`);
  await expect(page.getByTestId("creer-compte-tunnel")).toBeVisible();

  const email = `invite${Date.now()}@vito.test`;
  await page.getByTestId("compte-email").fill(email);
  await page.getByTestId("compte-mot-de-passe").fill("password123");
  await page.getByTestId("etape-suivante").click();

  await page.getByTestId("compte-prenom").fill("Camille");
  await page.getByTestId("compte-nom").fill("Invitée");
  await page.getByTestId("etape-suivante").click();

  // l'acceptation des conditions est explicite (jamais pré-cochée)
  await expect(page.getByTestId("compte-conditions")).not.toBeChecked();
  await page.getByTestId("compte-conditions").check();
  await page.getByTestId("creer-compte").click();

  await expect(page).toHaveURL(/\/fr\/bienvenue/, { timeout: 30_000 });
  await expect(page.getByTestId("premier-pas")).toBeVisible();

  // usage unique : le même jeton ne vaut plus rien
  await page.goto(`/fr/invitation/${token}`);
  await expect(page.getByTestId("invitation-invalide")).toBeVisible();
});

test("l'inscription publique est fermée côté API", async ({ request }) => {
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  test.skip(!cle, "clé anon absente de l'environnement");
  // Verrou n°1 : même en s'adressant directement à Supabase, sans passer par
  // l'application, aucun compte ne peut être créé.
  const reponse = await request.post("http://127.0.0.1:54321/auth/v1/signup", {
    headers: { apikey: cle!, "Content-Type": "application/json" },
    data: { email: `intrus${Date.now()}@vito.test`, password: "password123" },
  });
  expect(reponse.status()).toBe(422);
  expect(await reponse.text()).toContain("signup_disabled");
});

test("la landing renvoie vers l'invitation au lieu d'un formulaire d'inscription", async ({ page }) => {
  await page.goto("/fr");
  await page.getByTestId("tab-signup").click();
  await expect(page.getByTestId("inscription-sur-invitation")).toBeVisible();
  await page.getByRole("link", { name: "Inscription sur invitation" }).click();
  await expect(page.getByTestId("form-code-invitation")).toBeVisible();
});
