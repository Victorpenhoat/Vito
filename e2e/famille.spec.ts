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

test("ajouter un document à un proche via le tunnel OCR (mock) et le voir sur la fiche", async ({ page }) => {
  const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
  await login(page, "client@vito.test");
  // client a un proche seedé « Camille Durand » (Slice 3)
  await page.goto("/fr/famille");
  await page.getByTestId("proche-row").filter({ hasText: "Camille Durand" }).click();
  await expect(page).toHaveURL(/\/famille\/proches\//);
  await expect(page.getByRole("heading", { name: "Camille Durand" })).toBeVisible();

  await page.getByRole("link", { name: "Ajouter un document" }).click();
  await expect(page.getByTestId("document-tunnel")).toBeVisible();

  // A : Passeport est sélectionné par défaut → Continuer
  await page.getByRole("button", { name: "Continuer" }).click();
  // B : importer un PDF → déclenche C (OCR mock) puis D
  await page.getByTestId("tunnel-file").setInputFiles({ name: "passeport.pdf", mimeType: "application/pdf", buffer: PDF });
  // D : pré-rempli par le mock (pays France) → enregistrer
  await expect(page.getByTestId("tunnel-verify")).toBeVisible();
  await expect(page.locator('input[name="country"]')).toHaveValue("France");
  await page.getByRole("button", { name: "Enregistrer le document" }).click();

  // Retour fiche : le document apparaît, et la route déchiffrée renvoie 200
  await expect(page).toHaveURL(/\/famille\/proches\/[^/]+$/);
  const row = page.getByTestId("document-row").filter({ hasText: "Passeport" });
  await expect(row.first()).toBeVisible();
  const href = await row.first().getByRole("link", { name: "Voir le document" }).getAttribute("href");
  expect(href).toBeTruthy();
  const resp = await page.request.get(href!);
  expect(resp.status()).toBe(200);
});

test("ajouter, voir, modifier puis supprimer un proche", async ({ page }) => {
  await login(page, "premium@vito.test");
  await page.goto("/fr/famille");
  await page.getByRole("link", { name: "Ajouter un proche" }).first().click();
  await expect(page).toHaveURL(/\/famille\/proches\/nouveau/);

  await page.getByTestId("proche-form").locator('input[name="first_name"]').fill("Léa");
  await page.getByTestId("proche-form").locator('input[name="last_name"]').fill("Martin");
  await page.getByTestId("proche-form").locator('select[name="circle"]').selectOption("amis");
  await page.getByTestId("proche-form").getByRole("button", { name: "Enregistrer" }).click();

  // Redirigé vers la fiche
  await expect(page.getByRole("heading", { name: "Léa Martin" })).toBeVisible();

  // Visible dans la liste, section Amis
  await page.goto("/fr/famille");
  await expect(page.getByTestId("proche-row").filter({ hasText: "Léa Martin" })).toBeVisible();

  // Modifier — nav cliente rétablie : l'« erreur RSC intermittente » contournée ici était la
  // race anon 42501 (getProche → notFound / famille/error.tsx sous fenêtre anon), éradiquée
  // par les guards getUser des PR #61/#63/#64. L'attente du heading reste (rendu streamé).
  await page.getByTestId("proche-row").filter({ hasText: "Léa Martin" }).click();
  await expect(page).toHaveURL(/\/famille\/proches\//);
  await expect(page.getByRole("heading", { name: "Léa Martin" })).toBeVisible();
  await page.getByRole("link", { name: "Modifier" }).click();
  await page.getByTestId("proche-form").locator('input[name="last_name"]').fill("Bernard");
  await page.getByTestId("proche-form").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("heading", { name: "Léa Bernard" })).toBeVisible();

  // Supprimer (confirm auto-accepté)
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Supprimer" }).click();
  await expect(page).toHaveURL(/\/fr\/famille$/);
  await expect(page.getByTestId("proche-row").filter({ hasText: "Léa Bernard" })).toHaveCount(0);
});
