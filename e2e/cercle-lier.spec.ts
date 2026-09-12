import { test, expect } from "@playwright/test";
import { expectVisibleWithReload, login } from "./helpers";

// Se lier à quelqu'un qui a DÉJÀ un compte Vito (migration 00067) : le carnet
// montre un code (et son QR), l'autre l'ouvre et accepte, et chacun se retrouve
// dans le Cercle de l'autre.
//
// Le test est rejouable : la liaison est idempotente (l'index unique
// (user_id, profile_id) et la RPC réutilisent le lien déjà posé), donc aucune
// assertion ne porte sur un total ni sur une fiche fraîche.

test("deux comptes existants se lient par un code, dans les deux sens", async ({ browser }) => {
  // ── Le carnet obtient un code depuis l'écran d'ajout ──────────────────────
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await login(pageA, "client@vito.test");
  await pageA.goto("/fr/famille/proches/nouveau");
  await pageA.getByTestId("vers-lier-compte").click();
  await expect(pageA).toHaveURL(/\/fr\/famille\/lier/);

  await pageA.getByTestId("lier-relation-conjoint").click();
  await pageA.getByTestId("lier-obtenir-code").click();

  const panneau = pageA.getByTestId("code-lien");
  await expect(panneau).toBeVisible({ timeout: 15_000 });
  // Le QR est la voie principale (appareil photo) : sans lui, l'écran ne tient
  // pas sa promesse, même si le code s'affiche.
  await expect(pageA.getByTestId("code-lien-qr").locator("svg")).toBeVisible();
  const affiche = (await pageA.getByTestId("code-lien-code").textContent()) ?? "";
  const code = affiche.replace(/[^0-9A-Z]/gi, "");
  expect(code).toMatch(/^[2-9A-HJKMNP-TV-Z]{8}$/);

  // ── L'autre compte ouvre le lien du QR et accepte ─────────────────────────
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await login(pageB, "premium@vito.test");
  await pageB.goto(`/fr/lier/${code}`);
  await expect(pageB.getByTestId("lier-accueil")).toBeVisible();
  // la relation est pré-remplie par l'inverse de celle qu'a choisie l'émetteur
  await expect(pageB.getByTestId("accepter-relation")).toHaveValue("conjoint");
  await pageB.getByTestId("accepter-valider").click();
  await expect(pageB).toHaveURL(/\/fr\/famille$/, { timeout: 15_000 });

  // ── Chacun a désormais la fiche de l'autre ────────────────────────────────
  await expectVisibleWithReload(pageB, pageB.getByTestId("proche-row").filter({ hasText: "Victor" }).first());

  await pageA.goto("/fr/famille");
  await expectVisibleWithReload(pageA, pageA.getByTestId("proche-row").filter({ hasText: "Premium" }).first());

  // Le code ne vaut qu'une fois : rouvert, il n'ouvre plus rien.
  await pageB.goto(`/fr/lier/${code}`);
  await expect(pageB.getByTestId("lier-invalide")).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

test("un code mal formé est refusé sans interroger la base", async ({ page }) => {
  await login(page);
  await page.goto("/fr/famille/lier");
  const saisie = page.getByTestId("saisir-code");
  await saisie.locator('input[name="code"]').fill("pas-un-code");
  await saisie.getByRole("button").click();
  await expect(saisie.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/fr\/famille\/lier/);
});

test("un code inconnu ne dit rien de plus qu'un code expiré", async ({ page }) => {
  await login(page);
  await page.goto("/fr/lier/ZZZZZZZZ");
  await expect(page.getByTestId("lier-invalide")).toBeVisible();
});
