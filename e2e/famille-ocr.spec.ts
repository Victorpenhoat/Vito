import { test, expect, type Page } from "@playwright/test";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

test("route OCR : 401 sans auth", async ({ request }) => {
  const resp = await request.post("/api/famille/documents/read", {
    multipart: { docType: "passeport", file: { name: "p.pdf", mimeType: "application/pdf", buffer: PDF } },
  });
  expect(resp.status()).toBe(401);
});

test("route OCR : 400 type non supporté", async ({ page }) => {
  await login(page, "client@vito.test");
  const resp = await page.request.post("/api/famille/documents/read", {
    multipart: { docType: "passeport", file: { name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("nope") } },
  });
  expect(resp.status()).toBe(400);
});

test("route OCR : 200 + champs (mock) sans rien persister", async ({ page }) => {
  await login(page, "client@vito.test");
  const resp = await page.request.post("/api/famille/documents/read", {
    multipart: { docType: "passeport", file: { name: "p.pdf", mimeType: "application/pdf", buffer: PDF } },
  });
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body.fields.country).toBe("France");
  expect(body.fields.expiry_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
