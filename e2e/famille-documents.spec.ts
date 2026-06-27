import { test, expect, type Page } from "@playwright/test";

const DOC_ID = "d1111111-1111-4111-8111-111111111111";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

test("l'owner télécharge le document déchiffré (200, pdf)", async ({ page }) => {
  await login(page, "client@vito.test");
  const resp = await page.request.get(`/api/famille/documents/${DOC_ID}`);
  expect(resp.status()).toBe(200);
  expect(resp.headers()["content-type"]).toContain("application/pdf");
  expect(Buffer.from(await resp.body()).toString()).toContain("%PDF-1.4");
});

test("un non-owner obtient 404 (aucune fuite) et ne voit pas le proche", async ({ page }) => {
  await login(page, "free@vito.test");
  const resp = await page.request.get(`/api/famille/documents/${DOC_ID}`);
  expect(resp.status()).toBe(404);
  // RLS family_members : free ne voit pas le proche seedé de client (« Camille Durand »)
  await page.goto("/fr/famille");
  await expect(page.getByText("Camille Durand")).toHaveCount(0);
});
