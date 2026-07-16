import { test, expect, type Page } from "@playwright/test";
import { expectVisibleWithReload, expectTextWithReload } from "./helpers";

const BISTROT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

test("premium crée une demande resto depuis une fiche et la retrouve", async ({ page }) => {
  await login(page, "premium@vito.test");
  await page.goto(`/fr/restos/${BISTROT}`);

  // Le formulaire conciergerie est visible (premium)
  const form = page.getByTestId("demande-resto-form");
  await expect(form).toBeVisible();
  const tag = `E2E-${Date.now()}`;
  await form.locator('input[name="dateResa"]').fill("2026-11-20");
  await form.locator('input[name="heureResa"]').fill("19:30");
  await form.locator('input[name="nombreConvives"]').fill("3");
  await form.locator('textarea[name="commentaire"]').fill(tag);
  const submitBtn = form.getByRole("button");
  await submitBtn.click();
  // Attendre que l'action serveur se termine (le bouton repasse enabled)
  await expect(submitBtn).toBeEnabled({ timeout: 10000 });

  // La demande créée (commentaire unique) apparaît dans /conciergerie (vue client), statut Nouvelle
  await page.goto("/fr/conciergerie");
  const row = page.getByTestId("demande-row").filter({ hasText: tag });
  await expectVisibleWithReload(page, row);
  await expect(row.getByTestId("demande-statut")).toHaveText("Nouvelle");
});

test("le staff traite la demande démo du seed (statut + réponse)", async ({ page }) => {
  await login(page, "agence@vito.test");
  await page.goto("/fr/conciergerie");

  // Inbox staff : cibler la demande démo du seed
  const row = page.getByTestId("demande-row").filter({ hasText: "Demande démo conciergerie" });
  await expect(row).toBeVisible();
  await row.getByTestId("reponse-form").locator('select[name="statut"]').selectOption("confirmee");
  await row.getByTestId("reponse-form").locator('textarea[name="reponse"]').fill("Réservé, table confirmée");
  await row.getByTestId("reponse-form").getByRole("button").click();

  // La ligne reflète le nouveau statut (persistant serveur, rendu par revalidation en place →
  // reload-guard si le slot RSC post-action n'est pas commité sous charge CI)
  await expectTextWithReload(
    page,
    page.getByTestId("demande-row").filter({ hasText: "Demande démo conciergerie" }).getByTestId("demande-statut"),
    "Confirmée",
  );
});

test("un compte Free voit le CTA premium, pas le formulaire", async ({ page }) => {
  // client@vito.test : compte Free jamais abonné par un autre test (free@vito est souscrit
  // par l'e2e d'abonnement 6a → on l'évite ici pour ne pas dépendre de l'ordre des tests).
  // Test en lecture seule → n'affecte pas les e2e C4/C5 qui utilisent client.
  await login(page, "client@vito.test");
  await page.goto(`/fr/restos/${BISTROT}`);
  await expect(page.getByTestId("conciergerie-premium-cta")).toBeVisible();
  await expect(page.getByTestId("demande-resto-form")).toHaveCount(0);
});
