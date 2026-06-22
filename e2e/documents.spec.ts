import { test, expect, type Page } from "@playwright/test";

const ROME = "11111111-2222-4333-8444-555555555555";
// PDF minimal valide
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("déposer, lister, télécharger puis supprimer un document chiffré", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto(`/fr/voyages/${ROME}`);

  const tag = `doc-${Date.now()}.pdf`;
  await page.getByTestId("document-upload-form").locator('input[type="file"]').setInputFiles({
    name: tag, mimeType: "application/pdf", buffer: PDF,
  });
  await page.getByTestId("document-upload-form").locator('button[type="submit"]').click();

  // Apparaît dans la liste
  const row = page.getByTestId("document-row").filter({ hasText: tag });
  await expect(row).toBeVisible();

  // Téléchargement : la route renvoie 200 + content-type pdf, et le déchiffré == le PDF d'origine
  const href = await row.getByRole("link").getAttribute("href");
  expect(href).toBeTruthy();
  const resp = await page.request.get(href!);
  expect(resp.status()).toBe(200);
  expect(resp.headers()["content-type"]).toContain("application/pdf");
  expect(Buffer.from(await resp.body()).equals(PDF)).toBe(true);

  // Suppression
  await row.getByRole("button").click();
  await expect(page.getByTestId("document-row").filter({ hasText: tag })).toHaveCount(0);
});

test("un non-membre obtient 404 sur la route de téléchargement", async ({ browser }) => {
  // client (membre) dépose un document et récupère son URL
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await login(pageA, "client@vito.test");
  await pageA.goto(`/fr/voyages/${ROME}`);
  const tag = `priv-${Date.now()}.pdf`;
  await pageA.getByTestId("document-upload-form").locator('input[type="file"]').setInputFiles({ name: tag, mimeType: "application/pdf", buffer: PDF });
  await pageA.getByTestId("document-upload-form").locator('button[type="submit"]').click();
  const href = await pageA.getByTestId("document-row").filter({ hasText: tag }).getByRole("link").getAttribute("href");
  expect(href).toBeTruthy();

  // free@vito.test n'est pas membre du voyage Rome -> 404
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await login(pageB, "free@vito.test");
  const resp = await pageB.request.get(href!);
  expect(resp.status()).toBe(404);

  await ctxA.close();
  await ctxB.close();
});
