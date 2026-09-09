import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// L'audit du 9 septembre a lu les en-têtes réels de la production : seul
// strict-transport-security répondait, et il vient de Vercel. Ces tests
// existent pour que ce constat ne puisse pas se reproduire en silence.

const STATIQUES: ReadonlyArray<[string, string]> = [
  ["x-content-type-options", "nosniff"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  ["x-frame-options", "DENY"],
  ["cross-origin-opener-policy", "same-origin"],
  ["cross-origin-resource-policy", "same-origin"],
];

test("une page porte tous les en-têtes de sécurité", async ({ page }) => {
  const reponse = await page.goto("/fr/login");
  expect(reponse).not.toBeNull();
  const entetes = reponse!.headers();
  for (const [nom, valeur] of STATIQUES) expect(entetes[nom]).toBe(valeur);
  expect(entetes["permissions-policy"]).toContain("microphone=()");
  expect(entetes["permissions-policy"]).toContain("geolocation=(self)");
});

test("une route d'API les porte aussi — le proxy ne la voit pas, next.config si", async ({ request }) => {
  // 401 attendu (le proxy photo est fermé à l'anonyme) : ce qui compte est l'en-tête.
  const reponse = await request.get("/api/places/photo?ref=x");
  expect(reponse.headers()["x-content-type-options"]).toBe("nosniff");
  expect(reponse.headers()["x-frame-options"]).toBe("DENY");
});

test("la CSP est posée, porte une nonce, et n'autorise aucun script inline", async ({ page }) => {
  const reponse = await page.goto("/fr/login");
  const csp = reponse!.headers()["content-security-policy-report-only"];
  expect(csp).toBeTruthy();
  expect(csp).toMatch(/script-src [^;]*'nonce-[a-f0-9]{32}'/);
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).toContain("frame-ancestors 'none'");
  const scriptSrc = csp!.split("; ").find((d) => d.startsWith("script-src"));
  expect(scriptSrc).not.toContain("'unsafe-inline'");
});

test("la nonce change à chaque requête", async ({ page }) => {
  const lire = async () => {
    const r = await page.goto("/fr/login");
    return /'nonce-([a-f0-9]{32})'/.exec(r!.headers()["content-security-policy-report-only"] ?? "")?.[1];
  };
  const premiere = await lire();
  const seconde = await lire();
  expect(premiere).toBeTruthy();
  expect(seconde).not.toBe(premiere);
});

test("Next pose bien la nonce sur ses propres scripts", async ({ request }) => {
  const reponse = await request.get("/fr/login");
  const nonce = /'nonce-([a-f0-9]{32})'/.exec(
    reponse.headers()["content-security-policy-report-only"] ?? "",
  )?.[1];
  expect(nonce).toBeTruthy();
  // On lit le HTML SERVI, pas le DOM : le navigateur vide l'attribut nonce
  // après analyse, et un sélecteur CSS ne verrait plus rien. C'est la preuve
  // que la nonce traverse next-intl jusqu'au rendu — sans quoi la mesure du
  // Report-Only serait fausse et la CSP intenable une fois appliquée.
  expect(await reponse.text()).toContain(`nonce="${nonce}"`);
});

test("une page authentifiée qui rend la carte garde ses en-têtes", async ({ page }) => {
  await login(page);
  const reponse = await page.goto("/fr/restos");
  expect(reponse!.headers()["x-content-type-options"]).toBe("nosniff");
  expect(reponse!.headers()["content-security-policy-report-only"]).toContain("tile.openstreetmap.org");
});
