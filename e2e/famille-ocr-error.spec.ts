import { test, expect, type Page } from "@playwright/test";
import { expectVisibleWithReload } from "./helpers";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

async function openTunnel(page: Page) {
  await page.goto("/fr/famille");
  await page.getByTestId("proche-row").filter({ hasText: "Camille Durand" }).first().click();
  // le skeleton loading.tsx (Slice 6) peut retarder l'affichage de la fiche sur CI : attendre le contenu
  await expect(page).toHaveURL(/\/famille\/proches\//);
  await expectVisibleWithReload(page, page.getByRole("heading", { name: "Camille Durand" }));
  await page.getByRole("link", { name: "Ajouter un document" }).click();
  await expect(page.getByTestId("document-tunnel")).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click(); // étape A -> B
}

test("échec réseau OCR : l'étape C affiche l'erreur, puis « Saisir manuellement » -> D vide", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.route("**/api/famille/documents/read", (r) => r.abort());
  await openTunnel(page);
  await page.getByTestId("tunnel-file").setInputFiles({ name: "p.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByText("La lecture a échoué")).toBeVisible();
  await page.getByRole("button", { name: "Saisir manuellement" }).click();
  await expect(page.getByTestId("tunnel-verify")).toBeVisible();
  await expect(page.locator('input[name="country"]')).toHaveValue("");
});

test("« Réessayer la lecture » après rétablissement -> D pré-rempli (mock)", async ({ page }) => {
  await login(page, "client@vito.test");
  let fail = true;
  await page.route("**/api/famille/documents/read", (r) => (fail ? r.abort() : r.continue()));
  await openTunnel(page);
  await page.getByTestId("tunnel-file").setInputFiles({ name: "p.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByText("La lecture a échoué")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Réessayer la lecture" }).click();
  await expect(page.getByTestId("tunnel-verify")).toBeVisible();
  await expect(page.locator('input[name="country"]')).toHaveValue("France");
});
