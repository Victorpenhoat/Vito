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

  // elle quitte la boîte…
  await expect(pageB.getByTestId("reco-row")).toHaveCount(0, { timeout: 15_000 });
  // …et l'adresse est à son carnet, en « À tester », recommandée par le carnet
  await pageB.goto("/fr/restos?onglet=a_tester");
  const ajoutee = pageB.getByTestId("place-card").filter({ hasText: nomAdresse.trim().slice(0, 12) });
  await expectVisibleWithReload(pageB, ajoutee.first(), { timeout: 15_000 });

  await ctxA.close();
  await ctxB.close();
});
