import { test, expect } from "@playwright/test";
import { expectVisibleWithReload, login, ouvrirModale } from "./helpers";

// Cave (design Vins & Cave écrans 3, 4, 5 et 9) : la Cave est le 6ᵉ sous-onglet
// de Restaurants, « Mes vins » n'existe plus comme page séparée.

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("« Mes vins » redirige vers la Cave, dans Restaurants", async ({ page }) => {
  await login(page);
  await page.goto("/fr/vins");
  await expect(page).toHaveURL(/\/fr\/restos\?onglet=cave/);
  await expect(page.getByTestId("cave-panel")).toBeVisible();
  // le sous-onglet est bien celui de Restaurants
  await expect(page.getByTestId("restos-tabs").getByTestId("tab-cave")).toHaveAttribute("aria-selected", "true");
});

test("la Cave trie, filtre et retrouve un vin", async ({ page }) => {
  await login(page);
  await page.goto("/fr/restos?onglet=cave");

  const demo = page.getByTestId("cave-row").filter({ hasText: "Domaine de Démo" });
  await expect(demo).toBeVisible();

  // le vin du seed est noté 4,5 et marqué « à retrouver » : il tient les deux chips
  await page.getByTestId("cave-onglet-coups_de_coeur").click();
  await expect(demo).toBeVisible();
  await page.getByTestId("cave-onglet-a_retrouver").click();
  await expect(demo).toBeVisible();

  // la recherche porte sur le domaine, l'appellation et le cépage
  await page.getByTestId("cave-onglet-tous").click();
  await page.getByTestId("cave-recherche").fill("merlot");
  await expect(demo).toBeVisible();
  await page.getByTestId("cave-recherche").fill("chablis-qui-nexiste-pas");
  await expect(page.getByTestId("cave-vide")).toBeVisible();
});

test("capturer un vin enchaîne sur ma dégustation, notée en verres", async ({ page }) => {
  await login(page);
  await page.goto("/fr/restos?onglet=cave");
  await ouvrirModale(page, "ajouter-vin", "etiquette-tunnel");

  await page.getByTestId("etiquette-input").setInputFiles({
    name: "etiquette.png", mimeType: "image/png", buffer: Buffer.concat([PNG, PNG]),
  });
  await expect(page.getByTestId("etiquette-form")).toBeVisible({ timeout: 15_000 });

  // millésime unique par run : la dédup se fait sur (nom, domaine, millésime)
  const millesime = String(1900 + (Date.now() % 100));
  await page.getByTestId("champ-millesime").fill(millesime);
  // Signal serveur déterministe : on attend la RÉPONSE de l'action, pas la
  // transition d'interface. Sans cela, un échec d'enregistrement et une simple
  // course de rendu donnent la même erreur illisible (« ma-degustation
  // introuvable ») — c'est ce qui a rendu ce test difficile à diagnostiquer.
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    page.getByTestId("etiquette-enregistrer").click(),
  ]);

  // étape 2 / 2 : ma dégustation
  const degustation = page.getByTestId("ma-degustation");
  await expect(degustation).toBeVisible({ timeout: 15_000 });

  // note en verres : un clic donne le verre plein, un second le demi
  await degustation.getByTestId("verre-4").click();
  await expect(degustation.getByTestId("note-verres")).toHaveAttribute("data-note", "4");
  await degustation.getByTestId("verre-4").click();
  await expect(degustation.getByTestId("note-verres")).toHaveAttribute("data-note", "3.5");
  await degustation.getByTestId("verre-4").click();

  // tag de verdict créé à la volée + envie de le retrouver
  await degustation.getByTestId("tag-ouvrir").click();
  await degustation.getByTestId("tag-saisie").fill(`E2E ${millesime}`);
  await degustation.getByTestId("tag-valider").click();
  await expect(degustation.getByTestId("tag-nouveau")).toBeVisible();
  await degustation.getByTestId("a-racheter").check();

  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    degustation.getByTestId("enregistrer-degustation").click(),
  ]);

  // le vin rejoint la Cave, et le tri « À retrouver » le retient
  await expectVisibleWithReload(page, page.getByTestId("cave-row").filter({ hasText: "Bandol" }).first(), { timeout: 15_000 });
  await page.getByTestId("cave-onglet-a_retrouver").click();
  await expect(page.getByTestId("cave-row").filter({ hasText: "Bandol" }).first()).toBeVisible();
});

test("la fiche annonce son analyse générée, se corrige et se relance", async ({ page }) => {
  await login(page);
  await page.goto("/fr/restos?onglet=cave");
  await page.getByTestId("cave-row").filter({ hasText: "Domaine de Démo" }).getByRole("link").click();
  await expect(page).toHaveURL(/\/fr\/vins\//);

  // le vin du seed n'a pas d'étiquette : aucune analyse n'est inventée
  // état persistant → garde par rechargement (course routeur Next, PR #71)
  await expectVisibleWithReload(page, page.getByTestId("analyse-absente"));
  await expect(page.getByTestId("degustation-row").first()).toBeVisible();

  // relancer l'analyse : le service (mock) en produit une, la fiche l'annonce
  // alors comme générée — jamais comme une certitude
  await ouvrirModale(page, "corriger-analyse", "correction-form");
  await page.getByTestId("correction-appellation").fill("Bandol");
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    page.getByTestId("enregistrer-correction").click(),
  ]);
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    page.getByTestId("relancer-analyse").click(),
  ]);

  await expectVisibleWithReload(page, page.getByTestId("analyse-avertissement"), { timeout: 15_000 });
  await expect(page.getByTestId("profil-corps")).toBeVisible();
});
