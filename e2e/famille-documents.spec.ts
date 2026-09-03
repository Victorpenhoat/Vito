import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Données protégées (design Onboarding écran 11, lot O-D) : un scan d'identité
// ne s'ouvre plus avec une simple session — il faut une vérification récente,
// matérialisée par un ticket à usage unique.

const DOC_ID = "d1111111-1111-4111-8111-111111111111";
const PROCHE_ID = "f1111111-1111-4111-8111-111111111111";

test("sans vérification, la route refuse le document même à son propriétaire", async ({ page }) => {
  await login(page, "client@vito.test");
  const resp = await page.request.get(`/api/famille/documents/${DOC_ID}`);
  expect(resp.status()).toBe(401);
  expect(await resp.text()).toContain("verification_requise");
});

test("un ticket inventé ne vaut rien", async ({ page }) => {
  await login(page, "client@vito.test");
  const resp = await page.request.get(`/api/famille/documents/${DOC_ID}?ticket=ticket-invente`);
  expect(resp.status()).toBe(401);
});

test("un non-propriétaire n'obtient rien et ne voit pas le proche", async ({ page }) => {
  await login(page, "free@vito.test");
  const resp = await page.request.get(`/api/famille/documents/${DOC_ID}`);
  expect(resp.status()).toBe(401);
  // RLS family_members : free ne voit pas le proche seedé de client
  await page.goto("/fr/famille");
  await expect(page.getByText("Camille Durand")).toHaveCount(0);
});

test("après vérification, le scan s'affiche et son ticket ne sert qu'une fois", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto(`/fr/famille/proches/${PROCHE_ID}/documents/${DOC_ID}`);

  // le scan est verrouillé à l'ouverture de la page
  const afficher = page.getByTestId("afficher-scan");
  await expect(afficher).toBeVisible();
  await afficher.click();

  await page.getByTestId("reauth-scan-mot-de-passe").fill("password123");
  await page.getByTestId("reauth-scan-form").getByRole("button", { name: "Vérifier" }).click();

  // le document s'affiche : son URL porte le ticket délivré
  const cadre = page.locator('iframe[src*="/api/famille/documents/"]');
  await expect(cadre).toBeVisible({ timeout: 15_000 });
  const src = await cadre.getAttribute("src");
  expect(src).toContain("ticket=");

  // usage unique : le même ticket rejoué est refusé
  const rejoue = await page.request.get(src!);
  expect(rejoue.status()).toBe(401);
});

test("un mot de passe faux ne délivre aucun ticket", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto(`/fr/famille/proches/${PROCHE_ID}/documents/${DOC_ID}`);
  await page.getByTestId("afficher-scan").click();
  await page.getByTestId("reauth-scan-mot-de-passe").fill("mauvais-mot-de-passe");
  await page.getByTestId("reauth-scan-form").getByRole("button", { name: "Vérifier" }).click();
  await expect(page.getByTestId("reauth-scan-form").getByRole("alert")).toBeVisible({ timeout: 15_000 });
  // le scan reste verrouillé
  await expect(page.getByTestId("afficher-scan")).toBeVisible();
});

test("le numéro n'est pas dans la page, et se révèle après vérification", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto(`/fr/famille/proches/${PROCHE_ID}/documents/${DOC_ID}`);

  // le numéro seedé n'apparaît nulle part dans le HTML servi
  expect(await page.content()).not.toContain("19FR99892");
  await expect(page.getByTestId("numero-protege")).toContainText("•");

  await page.getByTestId("reveler-numero").click();
  await page.getByTestId("reauth-mot-de-passe").fill("password123");
  await page.getByTestId("reauth-form").getByRole("button", { name: "Vérifier" }).click();

  await expect(page.getByTestId("numero-protege")).toHaveText("19FR99892", { timeout: 15_000 });
  // on peut le masquer à nouveau
  await page.getByTestId("masquer-numero").click();
  await expect(page.getByTestId("numero-protege")).toContainText("•");
});
