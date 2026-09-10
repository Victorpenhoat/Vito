import { test, expect } from "@playwright/test";

// Connexion par lien magique (design Onboarding_Compte écrans 3 et 9).
// Les e2e lisent la boîte de réception locale de Supabase (Inbucket, activé
// dans supabase/config.toml) : le parcours est donc testé de bout en bout,
// jusqu'à l'ouverture du lien.

// Le serveur de test local est Mailpit (la section de config Supabase garde le
// nom historique « inbucket ») : liste sur /api/v1/messages, contenu sur
// /api/v1/message/{ID}.
const MAILPIT = "http://127.0.0.1:54324";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** En-têtes service role — c'est le seul rôle autorisé à appeler compte_existe. */
function admin() {
  return { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY!}`, "Content-Type": "application/json" };
}

/**
 * Interroge compte_existe (migration 00062) par le chemin le plus direct :
 * la même fonction que lienMagique.ts appelle. C'est la preuve qui a manqué
 * une première fois — generateLink CRÉE un compte pour une adresse inconnue,
 * une régression que rien d'autre dans ce fichier n'aurait détectée.
 */
async function compteExiste(request: import("@playwright/test").APIRequestContext, email: string): Promise<boolean> {
  const r = await request.post(`${SUPABASE_URL}/rest/v1/rpc/compte_existe`, {
    headers: admin(),
    data: { p_email: email },
  });
  expect(r.ok(), "appel à compte_existe").toBeTruthy();
  return (await r.json()) as boolean;
}

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

test("demander un lien affiche l'attente, sans révéler si le compte existe, et ne crée aucun compte", async ({ page, request }) => {
  test.skip(!SERVICE_KEY, "SUPABASE_SERVICE_ROLE_KEY absente");
  const email = `inconnu-total-${Date.now()}@vito.test`;

  await page.goto("/fr/login");
  // adresse inconnue : la réponse doit être la même que pour un compte existant
  await page.getByTestId("champ-email").fill(email);
  await page.getByTestId("envoyer-lien").click();
  await expect(page.getByTestId("attente-lien")).toBeVisible();
  await expect(page.getByTestId("attente-lien")).toContainText(email);
  // le renvoi est temporisé
  await expect(page.getByTestId("renvoyer-lien")).toBeDisabled();
  await expect(page.getByTestId("corriger-adresse")).toBeVisible();

  // La régression qu'un ancien plan avait laissé passer : generateLink CRÉE
  // le compte pour une adresse inconnue si on l'appelle sans avoir vérifié
  // avant. C'est l'assertion qui l'aurait attrapée.
  expect(await compteExiste(request, email), "aucun compte ne doit avoir été créé pour une adresse inconnue")
    .toBe(false);
});

test("le lien reçu par email connecte et mène à l'accueil", async ({ page, request }) => {
  const email = "client@vito.test";
  await viderBoite(request);

  await page.goto("/fr/login");
  await page.getByTestId("champ-email").fill(email);
  await page.getByTestId("envoyer-lien").click();
  await expect(page.getByTestId("attente-lien")).toBeVisible();

  // Le mail part de façon asynchrone : on attend qu'un message CONTENANT le lien
  // soit disponible, plutôt qu'un message quelconque (un mail d'un autre test
  // pouvait être lu en premier).
  let lien: string | undefined;
  await expect(async () => {
    const message = await dernierMessage(request, email);
    expect(message, "aucun message reçu").not.toBeNull();
    const corps = `${message!.Text ?? ""} ${message!.HTML ?? ""}`;
    lien = corps.match(/https?:\/\/[^\s"'<>]*token_hash=[^\s"'<>]+/)?.[0];
    expect(lien,
      "le mail doit porter un lien token_hash — si le sujet n'est pas « Votre lien de connexion Vito », "
      + "les conteneurs tournent avec l'ancienne config : relancer `supabase stop && supabase start`.",
    ).toBeTruthy();
  }).toPass({ timeout: 30_000 });

  await page.goto(lien!.replace(/&amp;/g, "&"));
  await expect(page).toHaveURL(/\/fr\/accueil/);
});

test("un lien invalide renvoie un message neutre", async ({ page }) => {
  await page.goto("/api/auth/confirm?token_hash=jetonbidon&type=email");
  await expect(page).toHaveURL(/\/fr\/login/);
  await expect(page.getByTestId("lien-invalide")).toBeVisible();
});
