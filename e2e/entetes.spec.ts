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
  const csp = reponse!.headers()["content-security-policy"];
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
    return /'nonce-([a-f0-9]{32})'/.exec(r!.headers()["content-security-policy"] ?? "")?.[1];
  };
  const premiere = await lire();
  const seconde = await lire();
  expect(premiere).toBeTruthy();
  expect(seconde).not.toBe(premiere);
});

test("Next pose bien la nonce sur ses propres scripts", async ({ request }) => {
  const reponse = await request.get("/fr/login");
  const nonce = /'nonce-([a-f0-9]{32})'/.exec(
    reponse.headers()["content-security-policy"] ?? "",
  )?.[1];
  expect(nonce).toBeTruthy();
  // On lit le HTML SERVI, pas le DOM : le navigateur vide l'attribut nonce
  // après analyse, et un sélecteur CSS ne verrait plus rien. C'est la preuve
  // que la nonce traverse next-intl jusqu'au rendu — sans quoi 'strict-dynamic'
  // bloquerait tous les scripts et la page se servirait muette.
  expect(await reponse.text()).toContain(`nonce="${nonce}"`);
});

// Le test qui compte depuis que la CSP mord. 'strict-dynamic' fait IGNORER
// 'self' dans script-src : une page dont le HTML est bâti sans requête n'a pas
// de nonce, donc pas un seul script autorisé. Elle répond 200 et ne fait rien.
// Rien dans le typage ne signale ce basculement — seule cette lecture le voit.
for (const chemin of ["/fr", "/en", "/fr/login", "/fr/confidentialite"]) {
  test(`aucune balise script sans nonce sur ${chemin}`, async ({ request }) => {
    const reponse = await request.get(chemin);
    expect(reponse.status()).toBe(200);
    const nonce = /'nonce-([a-f0-9]{32})'/.exec(reponse.headers()["content-security-policy"] ?? "")?.[1];
    expect(nonce).toBeTruthy();

    const html = await reponse.text();
    const balises = html.match(/<script\b[^>]*>/g) ?? [];
    expect(balises.length).toBeGreaterThan(0);
    expect(balises.filter((b) => !b.includes(`nonce="${nonce}"`))).toEqual([]);
  });
}

// Les URL sans route sont traitées au niveau du ROUTAGE : `not-found.tsx` ne
// les voit jamais, c'est `global-not-found.tsx` qui répond. Sans lui, le 404
// par défaut de Next répondait — prérendu en statique, donc sans nonce, donc
// dix scripts bloqués et autant de rapports à chaque visite.
const ATTENDU: ReadonlyArray<[string, string, string]> = [
  ["/fr/nexistepas", "fr", "Page introuvable"],
  ["/en/nope", "en", "Page not found"],
  ["/es/nada", "es", "Página no encontrada"],
  ["/it/niente", "it", "Pagina non trovata"],
];

for (const [chemin, lang, titre] of ATTENDU) {
  test(`une URL sans route rend le 404 de Vito en ${lang}, nonçé`, async ({ page }) => {
    const reponse = await page.goto(chemin);
    expect(reponse!.status()).toBe(404);
    await expect(page.getByRole("heading", { name: titre })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", lang);

    const html = await (await page.request.get(chemin)).text();
    const balises = html.match(/<script\b[^>]*>/g) ?? [];
    expect(balises.length).toBeGreaterThan(0);
    expect(balises.filter((b) => !b.includes("nonce="))).toEqual([]);
  });
}

test("sans cookie, le 404 global servi est déjà sombre", async ({ request }) => {
  // `global-not-found.tsx` contourne le layout [locale] : il a sa propre coque
  // HTML et a déjà porté sa propre copie (divergente) du défaut de thème. On
  // lit le HTML SERVI, comme pour /fr/login : un 404 est justement une page
  // qu'on n'hydrate pas forcément avant de la voir.
  const reponse = await request.get("/fr/ceci-nexiste-pas");
  expect(reponse.status()).toBe(404);
  const html = await reponse.text();
  expect(html).toContain('data-theme="dark"');
});

// Dix pages appellent notFound() pour une fiche absente ou appartenant à un
// autre compte. C'est le 404 qu'un vrai lecteur rencontre — pas l'URL tapée de
// travers. Il se rend dans le layout [locale], donc traduit ET nonçé, là où le
// 404 par défaut de Next est prérendu en statique, anglais et sans nonce.
test("une fiche absente rend le 404 de Vito, traduit et nonçé", async ({ page }) => {
  await login(page);
  const chemin = "/fr/famille/proches/00000000-0000-0000-0000-000000000000";
  const reponse = await page.goto(chemin);
  await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();

  // 200, et non 404 : cette version de Next rend `not-found` en 200 dès que la
  // réponse est en FLUX, et ne pose 404 que hors flux. Rien à corriger — mais
  // il vaut mieux l'écrire ici que le redécouvrir dans six mois.
  expect(reponse!.status()).toBe(200);

  const nonce = /'nonce-([a-f0-9]{32})'/.exec(reponse!.headers()["content-security-policy"] ?? "")?.[1];
  expect(nonce).toBeTruthy();
  const html = await (await page.request.get(chemin)).text();
  const balises = html.match(/<script\b[^>]*>/g) ?? [];
  expect(balises.length).toBeGreaterThan(0);
  expect(balises.filter((b) => !b.includes("nonce="))).toEqual([]);
});

test("une page authentifiée qui rend la carte garde ses en-têtes", async ({ page }) => {
  await login(page);
  const reponse = await page.goto("/fr/restos");
  expect(reponse!.headers()["x-content-type-options"]).toBe("nosniff");
  expect(reponse!.headers()["content-security-policy"]).toContain("tile.openstreetmap.org");
});
