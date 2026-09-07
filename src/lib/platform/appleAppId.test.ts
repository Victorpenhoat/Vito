import { describe, it, expect } from "vitest";
import { appIdValide } from "./appleAppId";

describe("appIdValide", () => {
  it("accepte un préfixe d'équipe suivi du bundle ID", () => {
    expect(appIdValide("Q7UGNF4Q22.com.badakan.vito")).toBe(true);
  });

  it("refuse le préfixe seul — l'erreur réellement commise", () => {
    // Servi tel quel, iOS met en cache un fichier qui ne désigne aucune app.
    expect(appIdValide("Q7UGNF4Q22")).toBe(false);
  });

  it("refuse ce qui n'a pas la forme attendue", () => {
    for (const v of [
      "",                              // vide
      "com.badakan.vito",              // bundle sans préfixe
      "Q7UGNF4Q22.vito",               // bundle sans point : pas un reverse-DNS
      "q7ugnf4q22.com.badakan.vito",   // préfixe en minuscules
      "Q7UGNF4Q2.com.badakan.vito",    // 9 caractères
      "Q7UGNF4Q222.com.badakan.vito",  // 11 caractères
      "Q7UGNF4Q22 .com.badakan.vito",  // espace
    ]) {
      expect(appIdValide(v), v).toBe(false);
    }
  });

  it("refuse l'absence de valeur sans lever", () => {
    expect(appIdValide(undefined)).toBe(false);
    expect(appIdValide(null)).toBe(false);
  });
});
