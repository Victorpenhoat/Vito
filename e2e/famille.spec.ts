import { test, expect, type Page } from "@playwright/test";

const BISTROT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

test("créer un foyer, inviter, partager un resto, vu par l'invité, et refus déjà-famille", async ({ browser }) => {
  // Contexte A : famille1 crée le foyer
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await login(pageA, "famille1@vito.test");
  await pageA.goto("/fr/famille");
  await pageA.getByTestId("famille-form").locator('input[name="nom"]').fill("Foyer Démo");
  await pageA.getByTestId("famille-form").getByRole("button").click();
  await expect(pageA.getByRole("heading", { name: "Foyer Démo" })).toBeVisible();

  // A ajoute un resto via une fiche (resto seed pré-sélectionné)
  await pageA.goto(`/fr/restos/${BISTROT}`);
  await pageA.getByTestId("ajouter-famille").click();
  await expect(pageA.getByTestId("ajouter-famille")).toBeEnabled({ timeout: 10000 });

  // A invite famille2
  await pageA.goto("/fr/famille");
  await pageA.getByTestId("invite-form").locator('input[name="email"]').fill("famille2@vito.test");
  await pageA.getByTestId("invite-form").getByRole("button").click();
  await expect(pageA.getByTestId("membre-row")).toHaveCount(2);

  // Contexte B : famille2 voit le foyer + le resto partagé
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await login(pageB, "famille2@vito.test");
  await pageB.goto("/fr/famille");
  await expect(pageB.getByRole("heading", { name: "Foyer Démo" })).toBeVisible();
  await expect(pageB.getByTestId("famille-resto-row")).toHaveCount(1);

  // A ré-invite famille2 (déjà membre) -> message « déjà dans une famille »
  await pageA.getByTestId("invite-form").locator('input[name="email"]').fill("famille2@vito.test");
  await pageA.getByTestId("invite-form").getByRole("button").click();
  await expect(pageA.getByTestId("invite-form").getByRole("alert")).toContainText("déjà");

  await ctxA.close();
  await ctxB.close();
});
