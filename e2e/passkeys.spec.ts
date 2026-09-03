import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

// Passkeys (design Onboarding écrans 4, 9 et 14). Chromium expose un
// authentificateur VIRTUEL via CDP : la cérémonie WebAuthn est donc jouée pour
// de vrai, sans matériel ni interaction humaine.

/** Branche un authentificateur de plateforme virtuel, avec vérification d'utilisateur. */
async function authentificateurVirtuel(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, authenticatorId };
}

test("enregistrer une passkey depuis les réglages, puis la révoquer", async ({ page }) => {
  await authentificateurVirtuel(page);
  await login(page);
  await page.goto("/fr/reglages");

  const section = page.getByTestId("passkeys-section");
  await expect(section).toBeVisible();
  // le compte de démonstration n'en a aucune au départ
  await expect(page.getByTestId("passkeys-vide")).toBeVisible();

  await page.getByTestId("passkey-ajouter").click();
  const ligne = page.getByTestId("passkey-row");
  await expect(ligne).toHaveCount(1, { timeout: 20_000 });

  // révocation : la liste redevient vide
  await page.getByTestId("passkey-revoquer").click();
  await expect(page.getByTestId("passkeys-vide")).toBeVisible({ timeout: 20_000 });
});

test("se connecter avec une passkey enregistrée", async ({ page, context }) => {
  await authentificateurVirtuel(page);
  await login(page);
  await page.goto("/fr/reglages");
  await page.getByTestId("passkey-ajouter").click();
  await expect(page.getByTestId("passkey-row")).toHaveCount(1, { timeout: 20_000 });

  // on se déconnecte en gardant l'authentificateur (il vit dans le contexte)
  await context.clearCookies();
  await page.goto("/fr/login");

  const bouton = page.getByTestId("connexion-passkey");
  await expect(bouton).toBeVisible({ timeout: 15_000 });
  await bouton.click();
  await expect(page).toHaveURL(/\/fr\/accueil/, { timeout: 30_000 });

  // nettoyage : la passkey ne doit pas survivre au test (base partagée)
  await page.goto("/fr/reglages");
  const revoquer = page.getByTestId("passkey-revoquer");
  if (await revoquer.count()) {
    await revoquer.first().click();
    await expect(page.getByTestId("passkeys-vide")).toBeVisible({ timeout: 20_000 });
  }
});

test("sans authentificateur, le bouton passkey ne s'affiche pas", async ({ page }) => {
  // aucun authentificateur virtuel : le navigateur n'a pas de passkey de
  // plateforme, le bouton doit rester masqué plutôt que d'échouer au clic.
  await page.goto("/fr/login");
  await expect(page.getByTestId("envoyer-lien")).toBeVisible();
  await expect(page.getByTestId("connexion-passkey")).toHaveCount(0);
});
