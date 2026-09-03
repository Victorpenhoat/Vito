import { test, expect } from "@playwright/test";
import { expectCountWithReload, expectVisibleWithReload, login } from "./helpers";

const ROME = "11111111-2222-4333-8444-555555555555";
// PDF minimal valide
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

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
  await expectVisibleWithReload(page, row);

  // Téléchargement : la route renvoie 200 + content-type pdf, et le déchiffré == le PDF d'origine
  const href = await row.getByRole("link").getAttribute("href");
  expect(href).toBeTruthy();
  const resp = await page.request.get(href!);
  expect(resp.status()).toBe(200);
  expect(resp.headers()["content-type"]).toContain("application/pdf");
  expect(Buffer.from(await resp.body()).equals(PDF)).toBe(true);

  // Suppression — reload-guard : si le refresh RSC post-action n'est pas commité, la ligne
  // supprimée resterait affichée pour de bon (rouge flaky) ; le reload re-rend la liste sans elle.
  await row.getByRole("button").click();
  await expectCountWithReload(page, page.getByTestId("document-row").filter({ hasText: tag }), 0);
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
  // reload-guard (race RSC post-action documentée #71/#77) : même garde que le test 1,
  // la ligne peut ne jamais apparaître si le refresh n'est pas commité sous charge.
  const row = pageA.getByTestId("document-row").filter({ hasText: tag });
  await expectVisibleWithReload(pageA, row);
  const href = await row.getByRole("link").getAttribute("href");
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
