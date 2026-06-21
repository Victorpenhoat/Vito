import { describe, it, expect } from "vitest";
import { MockMerchantProvider } from "./mock";

describe("MockMerchantProvider", () => {
  const p = new MockMerchantProvider();
  it("construit une URL de recherche encodée avec la quantité", () => {
    const url = p.buyUrl({ nom: "Château Test", domaine: "Domaine X", millesime: 2018, couleur: "rouge" }, 3);
    expect(url).toContain("qty=3");
    expect(url).toContain(encodeURIComponent("Château Test"));
    expect(url).toContain("2018");
  });
  it("quantité plancher à 1", () => {
    const url = p.buyUrl({ nom: "Vin", domaine: null, millesime: null, couleur: null }, 0);
    expect(url).toContain("qty=1");
  });
  it("nom vide => null", () => {
    expect(p.buyUrl({ nom: "", domaine: null, millesime: null, couleur: null }, 1)).toBeNull();
  });
});
