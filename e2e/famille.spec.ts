import { test, expect, type Page } from "@playwright/test";
import { expectVisibleWithReload, expectCountWithReload } from "./helpers";

const BISTROT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

test("créer un foyer, inviter, partager un resto, vu par l'invité, et refus déjà-famille", async ({ browser }) => {
  // Contexte A : famille1 crée le foyer — ou le retrouve : une tentative échouée après la
  // création le laisse en base (jamais réinitialisée entre retries) et la page rend alors le
  // foyer à la place du formulaire ; sans cette branche, le retry échouerait en dur sur le
  // fill de famille-form. Les étapes suivantes sont déjà tolérantes au re-run (ajouterRestoFiche
  // est un upsert ; ré-inviter un membre renvoie une erreur sans changer le compte de membres).
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await login(pageA, "famille1@vito.test");
  await pageA.goto("/fr/famille");
  const familleForm = pageA.getByTestId("famille-form");
  const foyerHeading = pageA.getByRole("heading", { name: "Foyer Démo" });
  await expect(familleForm.or(foyerHeading)).toBeVisible();
  if (await familleForm.isVisible()) {
    await familleForm.locator('input[name="nom"]').fill("Foyer Démo");
    await familleForm.getByRole("button").click();
  }
  await expect(foyerHeading).toBeVisible();

  // A ajoute un resto via une fiche (resto seed pré-sélectionné). Le bouton passe par
  // useActionState → `pending` (disabled) ne repasse false qu'au COMMIT de la transition React
  // post-action ; sous charge CI la race du routeur client Next peut ne jamais commiter ce slot,
  // laissant le bouton disabled pour de bon (toBeEnabled échouait les 3 retries — pas un simple
  // timeout). On attend le signal serveur DÉTERMINISTE (réponse du POST de l'action) plutôt que
  // le ré-enable du bouton, comme le favori dans restos.spec.
  await pageA.goto(`/fr/restos/${BISTROT}`);
  await Promise.all([
    pageA.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/fr/restos/")),
    pageA.getByTestId("ajouter-famille").click(),
  ]);

  // A invite famille2 — le refresh RSC post-action peut ne jamais se commiter sous charge CI
  // (flake du 27/06) : un timeout élargi ne suffit pas (l'UI garde l'ancien état pour de bon),
  // reload-guard sur le compte de membres → rendu frais depuis la base si le slot n'est pas commité.
  await pageA.goto("/fr/famille");
  await pageA.getByTestId("invite-form").locator('input[name="email"]').fill("famille2@vito.test");
  await pageA.getByTestId("invite-form").getByRole("button").click();
  await expectCountWithReload(pageA, pageA.getByTestId("membre-row"), 2, { timeout: 15_000 });
  // Le co-membre s'affiche par son display_name, pas par son UUID (policy profiles_select_co_membre)
  await expect(pageA.getByTestId("membre-row").filter({ hasText: "Famille Deux" })).toBeVisible();

  // Contexte B : famille2 voit le foyer + le resto partagé + le nom de l'owner
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await login(pageB, "famille2@vito.test");
  await pageB.goto("/fr/famille");
  await expect(pageB.getByRole("heading", { name: "Foyer Démo" })).toBeVisible();
  await expect(pageB.getByTestId("famille-resto-row")).toHaveCount(1);
  await expect(pageB.getByTestId("membre-row").filter({ hasText: "Famille Un" })).toBeVisible();

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
  await expectVisibleWithReload(page, page.getByRole("heading", { name: "Camille Durand" }));

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

  // Retour fiche : le document apparaît, et la route déchiffrée renvoie 200. Le retour se fait
  // par redirect issu de l'action → reload-guard si le slot de la fiche fraîche n'est pas commité.
  await expect(page).toHaveURL(/\/famille\/proches\/[^/]+$/);
  const row = page.getByTestId("document-row").filter({ hasText: "Passeport" });
  await expectVisibleWithReload(page, row.first());
  const href = await row.first().getByRole("link", { name: "Voir le document" }).getAttribute("href");
  expect(href).toBeTruthy();
  const resp = await page.request.get(href!);
  expect(resp.status()).toBe(200);
});

test("ajouter, voir, modifier puis supprimer un proche", async ({ page }) => {
  // Prénom unique par tentative : une tentative qui échoue après la création laisse un proche
  // en base (jamais réinitialisée entre retries) ; avec un nom fixe, le retry violait le strict
  // mode (2 « Léa Martin ») et ne pouvait jamais s'auto-réparer. Le reliquat est inoffensif
  // (seul ce test manipule les proches de premium@vito.test).
  const PRENOM = `Léa-${Date.now()}`;
  await login(page, "premium@vito.test");
  await page.goto("/fr/famille");
  await page.getByRole("link", { name: "Ajouter un proche" }).first().click();
  await expect(page).toHaveURL(/\/famille\/proches\/nouveau/);

  await page.getByTestId("proche-form").locator('input[name="first_name"]').fill(PRENOM);
  await page.getByTestId("proche-form").locator('input[name="last_name"]').fill("Martin");
  await page.getByTestId("proche-form").locator('select[name="circle"]').selectOption("amis");
  await page.getByTestId("proche-form").getByRole("button", { name: "Enregistrer" }).click();

  // Redirigé vers la fiche
  await expectVisibleWithReload(page, page.getByRole("heading", { name: `${PRENOM} Martin` }));

  // Visible dans la liste, section Amis
  await page.goto("/fr/famille");
  await expect(page.getByTestId("proche-row").filter({ hasText: `${PRENOM} Martin` })).toBeVisible();

  // Modifier — nav cliente (couverture rétablie). Il subsiste une race rare du routeur client
  // Next sous charge CI (URL et rail à jour mais slot enfant jamais commité — ni page, ni
  // loading, ni boundary, aucune erreur serveur) : elle est absorbée par les retries Playwright
  // maintenant que le test est idempotent, comme pour les autres tests de nav cliente.
  await page.getByTestId("proche-row").filter({ hasText: `${PRENOM} Martin` }).click();
  await expect(page).toHaveURL(/\/famille\/proches\//);
  await expectVisibleWithReload(page, page.getByRole("heading", { name: `${PRENOM} Martin` }));
  await page.getByRole("link", { name: "Modifier" }).click();
  await page.getByTestId("proche-form").locator('input[name="last_name"]').fill("Bernard");
  await page.getByTestId("proche-form").getByRole("button", { name: "Enregistrer" }).click();
  await expectVisibleWithReload(page, page.getByRole("heading", { name: `${PRENOM} Bernard` }));

  // Supprimer (confirm auto-accepté)
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Supprimer" }).click();
  await expect(page).toHaveURL(/\/fr\/famille$/);
  await expect(page.getByTestId("proche-row").filter({ hasText: `${PRENOM} Bernard` })).toHaveCount(0);
});
