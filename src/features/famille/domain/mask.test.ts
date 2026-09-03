import { describe, expect, it } from "vitest";
import { maskDocNumber } from "./mask";

// Le masque est désormais calculé SERVEUR : c'est la seule forme qui parvient au
// navigateur tant que l'identité n'a pas été vérifiée (lot O-D).
describe("maskDocNumber", () => {
  it("laisse voir les trois derniers caractères", () => {
    expect(maskDocNumber("19FR99892")).toBe("••••••892");
  });
  it("masque entièrement les valeurs très courtes", () => {
    expect(maskDocNumber("AB")).toBe("••");
    expect(maskDocNumber("ABC")).toBe("•••");
  });
  it("rend une chaîne vide sans numéro", () => {
    expect(maskDocNumber(null)).toBe("");
    expect(maskDocNumber("")).toBe("");
  });
  it("conserve la longueur de la valeur d'origine", () => {
    expect(maskDocNumber("CI-778812")).toHaveLength("CI-778812".length);
  });
});
