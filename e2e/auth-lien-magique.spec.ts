import { test, expect } from "@playwright/test";

// Connexion par lien magique (design Onboarding_Compte écrans 3 et 9).
// Les e2e lisent la boîte de réception locale de Supabase (Inbucket, activé
// dans supabase/config.toml) : le parcours est donc testé de bout en bout,
// jusqu'à l'ouverture du lien.

// Le serveur de test local est Mailpit (la section de config Supabase garde le
// nom historique « inbucket ») : liste sur /api/v1/messages, contenu sur
// /api/v1/message/{ID}.
const MAILPIT = "http://127.0.0.1:54324";

type Message = { ID: string; To: { Address: string }[]; Created: string };

/** Dernier message reçu par une adresse, avec son corps, ou null. */
async function dernierMessage(request: import("@playwright/test").APIRequestContext, email: string) {
  const liste = await request.get(`${MAILPIT}/api/v1/messages?limit=50`);
  if (!liste.ok()) return null;
  const { messages } = (await liste.json()) as { messages: Message[] };
  const pour = messages
    .filter((m) => m.To?.some((t) => t.Address.toLowerCase() === email.toLowerCase()))
    .sort((a, b) => b.Created.localeCompare(a.Created));
  if (pour.length === 0) return null;
  const detail = await request.get(`${MAILPIT}/api/v1/message/${pour[0]!.ID}`);
  return detail.ok() ? ((await detail.json()) as { Text?: string; HTML?: string }) : null;
}

async function viderBoite(request: import("@playwright/test").APIRequestContext) {
  await request.delete(`${MAILPIT}/api/v1/messages`).catch(() => undefined);
}

test("demander un lien affiche l'attente, sans révéler si le compte existe", async ({ page }) => {
  await page.goto("/fr/login");
  // adresse inconnue : la réponse doit être la même que pour un compte existant
  await page.getByTestId("champ-email").fill("inconnu-total@vito.test");
  await page.getByTestId("envoyer-lien").click();
  await expect(page.getByTestId("attente-lien")).toBeVisible();
  await expect(page.getByTestId("attente-lien")).toContainText("inconnu-total@vito.test");
  // le renvoi est temporisé
  await expect(page.getByTestId("renvoyer-lien")).toBeDisabled();
  await expect(page.getByTestId("corriger-adresse")).toBeVisible();
});

test("le lien reçu par email connecte et mène à l'accueil", async ({ page, request }) => {
  const email = "client@vito.test";
  await viderBoite(request);

  await page.goto("/fr/login");
  await page.getByTestId("champ-email").fill(email);
  await page.getByTestId("envoyer-lien").click();
  await expect(page.getByTestId("attente-lien")).toBeVisible();

  // le message arrive dans Inbucket (envoi asynchrone côté Supabase)
  let message: Awaited<ReturnType<typeof dernierMessage>> = null;
  await expect(async () => {
    message = await dernierMessage(request, email);
    expect(message).not.toBeNull();
  }).toPass({ timeout: 20_000 });

  const corps = `${message!.Text ?? ""} ${message!.HTML ?? ""}`;
  // le lien pointe sur notre route de confirmation, avec le jeton à usage unique
  const lien = corps.match(/https?:\/\/[^\s"'<>]*token_hash=[^\s"'<>]+/)?.[0];
  expect(lien, "le mail doit contenir un lien de confirmation").toBeTruthy();

  await page.goto(lien!.replace(/&amp;/g, "&"));
  await expect(page).toHaveURL(/\/fr\/accueil/);
});

test("un lien invalide renvoie un message neutre", async ({ page }) => {
  await page.goto("/api/auth/confirm?token_hash=jetonbidon&type=email");
  await expect(page).toHaveURL(/\/fr\/login/);
  await expect(page.getByTestId("lien-invalide")).toBeVisible();
});
