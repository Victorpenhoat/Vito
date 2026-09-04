import { test, expect } from "@playwright/test";
import { expectVisibleWithReload, login } from "./helpers";

// Boîte de réception (lot 2) : un proche recommande une adresse, elle attend
// dans ma boîte, je l'accepte et elle entre au carnet avec son origine.
//
// Le parcours complet passe par le lot 1 : sans compte rattaché au proche,
// personne ne peut rien recevoir.

test("recommander une adresse à un proche, qui l'accepte et la retrouve à son carnet", async ({ browser }) => {
  const marque = String(Date.now()).slice(-6);
  const prenom = `Reco${marque}`;
  const email = `reco${marque}@vito.test`;

  // ── Le carnet crée un proche neuf et l'invite (lot 1) ────────────────────
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await login(pageA, "client@vito.test");
  await pageA.goto("/fr/famille/proches/nouveau");
  await pageA.getByTestId("proche-form").locator('input[name="first_name"]').fill(prenom);
  await pageA.getByTestId("proche-form").locator('input[name="last_name"]').fill("Cercle");
  await pageA.getByTestId("proche-form").getByRole("button", { name: "Enregistrer" }).click();
  await expectVisibleWithReload(pageA, pageA.getByRole("heading", { name: `${prenom} Cercle` }));
  await pageA.getByTestId("compte-inviter").click();
  const lien = pageA.getByTestId("compte-lien");
  await expect(lien).toBeVisible({ timeout: 15_000 });
  const url = (await lien.textContent()) ?? "";
  const chemin = url.startsWith("http") ? new URL(url).pathname : url;

  // ── Le proche crée son compte ────────────────────────────────────────────
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await pageB.goto(chemin);
  await pageB.getByTestId("compte-email").fill(email);
  await pageB.getByTestId("compte-mot-de-passe").fill("password123");
  await pageB.getByTestId("etape-suivante").click();
  await pageB.getByTestId("compte-prenom").fill(prenom);
  await pageB.getByTestId("compte-nom").fill("Cercle");
  await pageB.getByTestId("etape-suivante").click();
  await pageB.getByTestId("compte-conditions").check();
  await pageB.getByTestId("creer-compte").click();
  await expect(pageB).toHaveURL(/\/fr\/bienvenue/, { timeout: 30_000 });

  // ── Le carnet lui recommande une adresse depuis sa fiche ─────────────────
  await pageA.goto("/fr/restos?onglet=tous");
  await pageA.getByTestId("place-card").first().getByRole("link").first().click();
  await expect(pageA).toHaveURL(/\/fr\/restos\/[0-9a-f-]{36}/);
  const nomAdresse = (await pageA.getByRole("heading").first().textContent()) ?? "";

  await pageA.getByTestId("recommander").click();
  const form = pageA.getByTestId("recommander-form");
  await expect(form).toBeVisible();
  await form.getByTestId("recommander-mot").fill(`Pour toi ${marque}`);
  // le proche fraîchement rattaché figure parmi les destinataires possibles
  const destinataire = form.locator("li").filter({ hasText: prenom });
  await destinataire.getByRole("button").click();
  await expect(form.getByTestId("recommander-envoye")).toBeVisible({ timeout: 15_000 });

  // ── Le proche la trouve dans sa boîte et l'accepte ───────────────────────
  await pageB.goto("/fr/reception");
  const carte = pageB.getByTestId("reco-row").first();
  await expectVisibleWithReload(pageB, carte, { timeout: 15_000 });
  await expect(carte).toContainText(`Pour toi ${marque}`);
  await carte.getByTestId("reco-accepter").click();

  // le menu annonçait ce qui l'attendait (lot 3)
  await expect(pageB.getByTestId("nav-reception-badge").first()).toBeVisible();

  // elle quitte la boîte…
  await expect(pageB.getByTestId("reco-row")).toHaveCount(0, { timeout: 15_000 });
  // …et l'adresse est à son carnet, en « À tester », recommandée par le carnet
  await pageB.goto("/fr/restos?onglet=a_tester");
  const ajoutee = pageB.getByTestId("place-card").filter({ hasText: nomAdresse.trim().slice(0, 12) });
  await expectVisibleWithReload(pageB, ajoutee.first(), { timeout: 15_000 });

  // côté expéditeur, l'historique garde la trace — sans dire ce qu'elle est
  // devenue (refuser ne se notifie pas)
  await pageA.goto("/fr/reception");
  const envoyee = pageA.getByTestId("reco-envoyee").filter({ hasText: prenom });
  await expectVisibleWithReload(pageA, envoyee.first(), { timeout: 15_000 });

  await ctxA.close();
  await ctxB.close();
});

// Les vins : recommander une bouteille. Elle n'a pas de fournisseur — accepter
// la crée dans la Cave du destinataire, par la même RPC de dédoublonnage que la
// capture d'étiquette.
test("recommander un vin, que le proche retrouve dans sa cave", async ({ browser }) => {
  const marque = String(Date.now()).slice(-6);
  const prenom = `Vin${marque}`;

  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await login(pageA, "client@vito.test");
  await pageA.goto("/fr/famille/proches/nouveau");
  await pageA.getByTestId("proche-form").locator('input[name="first_name"]').fill(prenom);
  await pageA.getByTestId("proche-form").locator('input[name="last_name"]').fill("Cercle");
  await pageA.getByTestId("proche-form").getByRole("button", { name: "Enregistrer" }).click();
  await expectVisibleWithReload(pageA, pageA.getByRole("heading", { name: `${prenom} Cercle` }));
  await pageA.getByTestId("compte-inviter").click();
  const lien = pageA.getByTestId("compte-lien");
  await expect(lien).toBeVisible({ timeout: 15_000 });
  const url = (await lien.textContent()) ?? "";
  const chemin = url.startsWith("http") ? new URL(url).pathname : url;

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await pageB.goto(chemin);
  await pageB.getByTestId("compte-email").fill(`vin${marque}@vito.test`);
  await pageB.getByTestId("compte-mot-de-passe").fill("password123");
  await pageB.getByTestId("etape-suivante").click();
  await pageB.getByTestId("compte-prenom").fill(prenom);
  await pageB.getByTestId("compte-nom").fill("Cercle");
  await pageB.getByTestId("etape-suivante").click();
  await pageB.getByTestId("compte-conditions").check();
  await pageB.getByTestId("creer-compte").click();
  await expect(pageB).toHaveURL(/\/fr\/bienvenue/, { timeout: 30_000 });

  // depuis la fiche d'un vin de sa cave, le carnet le recommande
  await pageA.goto("/fr/restos?onglet=cave");
  await pageA.getByTestId("cave-row").filter({ hasText: "Domaine de Démo" }).first().getByRole("link").click();
  await expect(pageA).toHaveURL(/\/fr\/vins\//);
  await pageA.getByTestId("recommander").click();
  const form = pageA.getByTestId("recommander-form");
  await form.getByTestId("recommander-mot").fill(`À goûter ${marque}`);
  await form.locator("li").filter({ hasText: prenom }).getByRole("button").click();
  await expect(form.getByTestId("recommander-envoye")).toBeVisible({ timeout: 15_000 });

  // le proche l'accepte : la bouteille rejoint SA cave
  await pageB.goto("/fr/reception");
  const carte = pageB.getByTestId("reco-row").first();
  await expectVisibleWithReload(pageB, carte, { timeout: 15_000 });
  await expect(carte).toContainText(`À goûter ${marque}`);
  await carte.getByTestId("reco-accepter").click();
  await expect(pageB.getByTestId("reco-row")).toHaveCount(0, { timeout: 15_000 });

  await pageB.goto("/fr/restos?onglet=cave");
  await expectVisibleWithReload(
    pageB,
    pageB.getByTestId("cave-row").filter({ hasText: "Démo" }).first(),
    { timeout: 15_000 },
  );

  await ctxA.close();
  await ctxB.close();
});
