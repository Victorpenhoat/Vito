import { test, expect } from "@playwright/test";

// Universal Links : le fichier qu'iOS va chercher pour savoir quelles URL de ce
// domaine appartiennent à l'app.
test.describe("apple-app-site-association", () => {
  test("sans identifiant d'app VALIDE, la route répond 404 — pas un fichier à moitié juste", async ({ request }) => {
    // APPLE_APP_ID n'est pas défini en test. La route exige la forme complète
    // « <App ID Prefix>.<bundle ID> » : le préfixe d'équipe seul produirait un
    // fichier syntaxiquement valide et parfaitement inutile — l'erreur a été
    // commise en production. iOS met en cache ce qu'il télécharge ; un mauvais
    // identifiant se paie en heures d'attente. La forme est éprouvée par
    // src/lib/platform/appleAppId.test.ts, qui peut la faire varier.
    const res = await request.get("/.well-known/apple-app-site-association");
    expect(res.status()).toBe(404);
  });

  test("le chemin échappe à la redirection de langue, comme iOS l'exige", async ({ request }) => {
    // Le proxy d'internationalisation renverrait un 307 vers /fr/… : iOS
    // abandonnerait. Le point dans « .well-known » l'en exclut.
    const res = await request.get("/.well-known/apple-app-site-association", { maxRedirects: 0 });
    expect(res.status()).not.toBe(307);
    expect(res.status()).not.toBe(308);
  });
});
