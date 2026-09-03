import { describe, expect, it } from "vitest";
import { aConfirmer, cleDedup, nomDepuisEtiquette } from "./etiquette";

describe("nomDepuisEtiquette", () => {
  it("préfère la cuvée, puis l'appellation, puis le domaine", () => {
    expect(nomDepuisEtiquette({ cuvee: "La Tourtine", appellation: "Bandol", domaine: "Tempier" })).toBe("La Tourtine");
    expect(nomDepuisEtiquette({ cuvee: null, appellation: "Bandol", domaine: "Tempier" })).toBe("Bandol");
    expect(nomDepuisEtiquette({ cuvee: "  ", appellation: null, domaine: "Tempier" })).toBe("Tempier");
  });
  it("retourne null quand rien n'est lisible", () => {
    expect(nomDepuisEtiquette({ cuvee: null, appellation: null, domaine: null })).toBeNull();
    expect(nomDepuisEtiquette({ cuvee: "", appellation: "  ", domaine: "" })).toBeNull();
  });
});

describe("cleDedup", () => {
  it("normalise casse, espaces et millésime absent comme l'index unique", () => {
    expect(cleDedup("  Bandol ", "Domaine Tempier", 2021)).toBe("bandol|2021|domaine tempier");
    expect(cleDedup("Bandol", null, null)).toBe("bandol|0|");
    expect(cleDedup("BANDOL", "TEMPIER", 2021)).toBe(cleDedup("bandol", "tempier", 2021));
  });
});

describe("aConfirmer", () => {
  it("demande confirmation quand le modèle doute ou ne dit rien", () => {
    expect(aConfirmer("a_verifier")).toBe(true);
    expect(aConfirmer(undefined)).toBe(true);
    expect(aConfirmer("sur")).toBe(false);
    expect(aConfirmer("probable")).toBe(false);
  });
});
