import { test, expect } from "@playwright/test";
import { deverrouillerSiBesoin, login } from "./helpers";

// Verrouillage de l'application (design Onboarding écrans 6 et 10).
// Le verrou masque l'affichage après inactivité ; les gardes serveur des
// données protégées restent indépendantes (cf. famille-documents.spec).

test("le carnet n'est pas verrouillé pendant l'usage", async ({ page }) => {
  await login(page);
  await page.goto("/fr/reglages");
  await expect(page.getByTestId("verrou-app")).toHaveCount(0);
});

test("le délai de verrouillage se règle depuis les réglages", async ({ page }) => {
  await login(page);
  await page.goto("/fr/reglages");
  await expect(page.getByTestId("verrou-form")).toBeVisible();
  // le délai du seed est celui par défaut (5 min)
  await expect(page.getByTestId("verrou-delai-5")).toBeChecked();

  await page.getByTestId("verrou-delai-15").check({ force: true });
  const done = page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400, { timeout: 60_000 });
  await page.getByTestId("verrou-form").getByRole("button", { name: "Enregistrer" }).click();
  await done;
  await page.reload();
  await expect(page.getByTestId("verrou-delai-15")).toBeChecked();

  // remise en état pour les autres specs (base partagée)
  await page.getByTestId("verrou-delai-5").check({ force: true });
  const retour = page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400, { timeout: 60_000 });
  await page.getByTestId("verrou-form").getByRole("button", { name: "Enregistrer" }).click();
  await retour;
});

test("après une longue absence, le carnet est masqué puis rouvert par mot de passe", async ({ page }) => {
  await login(page);
  await page.goto("/fr/reglages");
  await deverrouillerSiBesoin(page);

  // On simule un RETOUR dans l'app après 20 minutes d'absence (le délai du seed
  // est de 5 min). Recharger ne conviendrait pas : quitter la page note l'heure
  // de départ, ce qui effacerait justement l'absence qu'on veut simuler.
  await page.evaluate(() => {
    localStorage.setItem("vito.derniere-activite", String(Date.now() - 20 * 60 * 1000));
    document.dispatchEvent(new Event("visibilitychange"));
  });

  const verrou = page.getByTestId("verrou-app");
  await expect(verrou).toBeVisible();
  // rien du carnet ne reste lisible derrière : l'écran couvre tout le viewport
  // et son fond est opaque (le contenu reste dans le DOM — le verrou est une
  // protection d'affichage, les gardes serveur sont ailleurs).
  await expect(verrou).toContainText("Aucune donnée affichée");
  const boite = await verrou.boundingBox();
  const vue = page.viewportSize()!;
  expect(boite!.width).toBeGreaterThanOrEqual(vue.width);
  expect(boite!.height).toBeGreaterThanOrEqual(vue.height);

  // mot de passe erroné : le verrou tient
  await page.getByTestId("verrou-mot-de-passe").fill("mauvais");
  await page.getByTestId("verrou-deverrouiller").click();
  await expect(verrou.getByRole("alert")).toBeVisible({ timeout: 15_000 });

  // bon mot de passe : le carnet réapparaît
  await page.getByTestId("verrou-mot-de-passe").fill("password123");
  await page.getByTestId("verrou-deverrouiller").click();
  await expect(page.getByTestId("verrou-app")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId("reglages-sections")).toBeVisible();
});
