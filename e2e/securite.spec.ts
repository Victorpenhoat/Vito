import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Réglages > Sécurité : double authentification et sessions
// (design Onboarding écrans 14 et 15).

test("activer puis désactiver la double authentification", async ({ page }) => {
  await login(page);
  await page.goto("/fr/reglages");
  const section = page.getByTestId("totp-section");
  await expect(section).toBeVisible();

  await page.getByTestId("totp-activer").click();
  // le SDK renvoie un QR en data-URI et la clé en clair, à saisir à la main
  await expect(page.getByTestId("totp-qr")).toBeVisible({ timeout: 20_000 });
  const secret = await page.getByTestId("totp-secret").textContent();
  expect(secret?.trim().length ?? 0).toBeGreaterThan(10);

  // un code erroné est refusé, sans activer le facteur
  await page.getByTestId("totp-code").fill("000000");
  await page.getByTestId("totp-confirmer").click();
  await expect(section.getByRole("alert")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("totp-actif")).toHaveCount(0);

  // on quitte sans activer : la page rechargée ne montre pas de facteur actif
  await page.reload();
  await expect(page.getByTestId("totp-activer")).toBeVisible();
});

test("la session courante est identifiée et n'est pas révocable", async ({ page }) => {
  await login(page);
  await page.goto("/fr/reglages");
  const section = page.getByTestId("sessions-section");
  await expect(section).toBeVisible();

  // au moins la session du navigateur courant, marquée « Cet appareil »
  await expect(page.getByTestId("session-row").first()).toBeVisible();
  await expect(page.getByTestId("session-courante")).toBeVisible();
  // la ligne courante n'expose pas de bouton de révocation
  const ligneCourante = page.getByTestId("session-row").filter({ has: page.getByTestId("session-courante") });
  await expect(ligneCourante.getByTestId("session-revoquer")).toHaveCount(0);
});

test("une session ouverte ailleurs peut être révoquée", async ({ page, browser }) => {
  await login(page);

  await page.goto("/fr/reglages");
  const lignes = page.getByTestId("session-row");
  // La base est partagée : les runs précédents laissent des sessions. On part
  // d'un état connu en fermant les autres appareils.
  const fermerAutres = page.getByTestId("sessions-revoquer-toutes");
  if (await fermerAutres.count()) {
    await fermerAutres.click();
    await expect(lignes).toHaveCount(1, { timeout: 20_000 });
  }

  // deuxième navigateur : une session de plus pour le même compte
  const encore = await browser.newContext();
  const encorePage = await encore.newPage();
  await login(encorePage);
  await encore.close();

  await page.reload();
  await expect(lignes).toHaveCount(2, { timeout: 20_000 });

  // révocation de l'autre appareil : il ne reste que la session courante
  await page.getByTestId("session-revoquer").first().click();
  await expect(lignes).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByTestId("session-courante")).toBeVisible();
});

test("les connexions récentes sont listées sans localisation précise", async ({ page }) => {
  await login(page);
  await page.goto("/fr/reglages");
  const historique = page.getByTestId("connexions-recentes");
  await expect(historique).toBeVisible();
  await expect(historique.locator("li").first()).toBeVisible();
  await expect(page.getByTestId("sessions-section")).toContainText("sans géolocalisation précise");
});
