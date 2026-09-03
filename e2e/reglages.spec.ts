import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Réglages (design Onboarding_Compte écran 13) : profil éditable et sommaire des
// sections. Les sections pas encore livrées sont annoncées « Bientôt » — aucune
// assertion ne les nomme, pour ne pas devoir corriger ce test à chaque lot.

test("les réglages sont accessibles depuis le menu et montrent le sommaire", async ({ page }) => {
  await login(page);
  await page.goto("/fr/reglages");
  await expect(page.getByTestId("reglages-sections")).toBeVisible();
  await expect(page.getByTestId("section-profil")).toBeVisible();
  await expect(page.getByTestId("section-tags")).toBeVisible();
  // Les sections livrées sont navigables. On ne nomme plus la section « à venir »
  // dans l'assertion : elle a rendu ce test caduc à chaque lot qui en activait une.
  for (const cle of ["profil", "tags", "securite", "appareils", "donnees"]) {
    await expect(page.getByTestId(`section-${cle}`)).not.toContainText("Bientôt");
  }
  // « Comptes » est réservé à l'administrateur
  await expect(page.getByTestId("section-comptes")).toHaveCount(0);
});

test("l'administrateur voit la section Comptes", async ({ page }) => {
  await login(page, "admin@vito.test");
  await page.goto("/fr/reglages");
  await expect(page.getByTestId("section-comptes")).toBeVisible();
});

test("modifier son profil met à jour le nom affiché dans le shell", async ({ page }) => {
  await login(page);
  await page.goto("/fr/reglages");
  await expect(page.getByTestId("profil-form")).toBeVisible();
  // prénom unique par run : la base est partagée entre les specs
  const prenom = `Victor${Date.now() % 100000}`;
  await page.getByTestId("profil-prenom").fill(prenom);
  await page.getByTestId("profil-nom").fill("Penhoat");

  // signal serveur déterministe (l'action revalide tout le layout)
  const enregistre = page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400, { timeout: 60_000 });
  await page.getByTestId("profil-form").getByRole("button", { name: "Enregistrer" }).click();
  await enregistre;

  // le nom dérivé s'affiche dans le shell (desktop : pied de la sidebar)
  await page.reload();
  await expect(page.getByTestId("profil-prenom")).toHaveValue(prenom);

  // remise en état pour les autres specs (nom affiché du seed)
  await page.getByTestId("profil-prenom").fill("Victor (client)");
  await page.getByTestId("profil-nom").fill("");
  const restaure = page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400, { timeout: 60_000 });
  await page.getByTestId("profil-form").getByRole("button", { name: "Enregistrer" }).click();
  await restaure;
});
