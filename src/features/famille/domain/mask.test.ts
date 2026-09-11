import { describe, expect, it } from "vitest";
import { maskDocNumber } from "./mask";

// Le masque est calculé SERVEUR : c'est la seule forme qui parvient au
// navigateur tant que l'identité n'a pas été vérifiée (lot O-D).
//
// La règle est posée par docs/security.md §2 et vaut pour TOUTE donnée
// protégée — les codes d'accès des Activités l'appliquent déjà
// (`activites/domain/protege.ts`). Elle tient en deux interdits : le masque ne
// laisse filtrer aucun caractère, et il n'annonce pas la longueur.
describe("maskDocNumber", () => {
  it("ne laisse filtrer aucun caractère de la valeur", () => {
    expect(maskDocNumber("19FR99892")).toBe("••••");
  });

  it("fait quatre points quelle que soit la longueur réelle", () => {
    // Deux numéros de longueurs très différentes rendent le MÊME masque : un
    // masque qui suit la longueur annonce combien de caractères chercher.
    expect(maskDocNumber("AB")).toBe("••••");
    expect(maskDocNumber("CI-778812")).toBe("••••");
    expect(maskDocNumber("X".repeat(40))).toBe("••••");
  });

  it("rend une chaîne vide sans numéro", () => {
    // Pas de masque sans valeur : quatre points diraient qu'un numéro existe.
    expect(maskDocNumber(null)).toBe("");
    expect(maskDocNumber("")).toBe("");
  });
});
