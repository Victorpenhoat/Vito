import { test, expect } from "@playwright/test";
import { login, ouvrirModale } from "./helpers";

// Capture d'étiquette (design Vins & Cave écrans 2 et 11). Le provider mock
// (aucune clé Anthropic en test) renvoie une fixture déterministe : « Domaine
// Tempier / Bandol 2021 », avec un millésime marqué « À vérifier ». Une image
// d'un seul octet simule la photo illisible.

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("la route de lecture refuse l'anonyme puis l'entrée invalide", async ({ page, request }) => {
  // sans session : 401
  const anon = await request.post("/api/vins/etiquette/read", { multipart: { hint: "Chablis" } });
  expect(anon.status()).toBe(401);

  await login(page);
  // connecté mais sans photo ni description : 400
  const vide = await page.request.post("/api/vins/etiquette/read", { multipart: {} });
  expect(vide.status()).toBe(400);
  // type non supporté : 400
  const mauvaisType = await page.request.post("/api/vins/etiquette/read", {
    multipart: { file: { name: "e.txt", mimeType: "text/plain", buffer: Buffer.from("x") } },
  });
  expect(mauvaisType.status()).toBe(400);
});

test("capturer une étiquette : champs reconnus, confiance, création du vin", async ({ page }) => {
  await login(page);
  await page.goto("/fr/vins");
  await ouvrirModale(page, "ajouter-vin", "etiquette-tunnel");

  // photo « lisible » (> 1 octet) → la fixture remplit les champs
  await page.getByTestId("etiquette-input").setInputFiles({
    name: "etiquette.png", mimeType: "image/png", buffer: Buffer.concat([PNG_1PX, PNG_1PX]),
  });
  await expect(page.getByTestId("etiquette-form")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("champ-domaine")).toHaveValue("Domaine Tempier");
  await expect(page.getByTestId("champ-millesime")).toHaveValue("2021");
  // le millésime est douteux dans la fixture : la confiance est affichée
  await expect(page.getByTestId("confiance-millesime")).toHaveText("À vérifier");
  await expect(page.getByTestId("confiance-domaine")).toHaveText("Sûr");

  // le nom est dérivé de la cuvée : millésime unique par run pour rester idempotent
  const millesime = String(1980 + (Date.now() % 40));
  await page.getByTestId("champ-millesime").fill(millesime);
  // Signal serveur déterministe : on attend la RÉPONSE de l'action, pas la
  // transition d'interface. Sans cela, un échec d'enregistrement et une simple
  // course de rendu donnent la même erreur illisible (« ma-degustation
  // introuvable ») — c'est ce qui a rendu ce test difficile à diagnostiquer.
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400),
    page.getByTestId("etiquette-enregistrer").click(),
  ]);

  // création → étape 2 / 2 : la modale reste ouverte sur « Ma dégustation »
  // (design écran 3), le vin n'est pas encore noté.
  await expect(page.getByTestId("ma-degustation")).toBeVisible({ timeout: 15_000 });
});

test("photo illisible : message dédié, réessayer ou saisir à la main", async ({ page }) => {
  await login(page);
  await page.goto("/fr/vins");
  await ouvrirModale(page, "ajouter-vin", "etiquette-tunnel");
  // 1 octet → le mock répond « illisible »
  await page.getByTestId("etiquette-input").setInputFiles({
    name: "sombre.png", mimeType: "image/png", buffer: Buffer.from([0]),
  });
  await expect(page.getByTestId("etiquette-illisible")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("etiquette-reessayer")).toBeVisible();
  // les champs restent saisissables à la main
  await expect(page.getByTestId("champ-domaine")).toBeVisible();
});
