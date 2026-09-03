import { describe, it, expect } from "vitest";
import { degustationCompleteSchema, correctionAnalyseSchema } from "./schemas";

const VIN = "11111111-1111-4111-8111-111111111111";

describe("degustationCompleteSchema", () => {
  it("accepte une dégustation minimale : un vin suffit", () => {
    expect(degustationCompleteSchema.safeParse({ vinId: VIN }).success).toBe(true);
  });

  it("exige un vin : une dégustation sans vin n'a pas de sens", () => {
    expect(degustationCompleteSchema.safeParse({}).success).toBe(false);
    expect(degustationCompleteSchema.safeParse({ vinId: "pas-un-uuid" }).success).toBe(false);
  });

  it("arrondit la note au demi-verre le plus proche", () => {
    const note = (v: number) => degustationCompleteSchema.parse({ vinId: VIN, note: v }).note;
    expect(note(4.5)).toBe(4.5);
    expect(note(4.3)).toBe(4.5);
    expect(note(4.1)).toBe(4);
  });

  it("borne la note à [0,5 ; 5] verres", () => {
    for (const v of [6, 0, -1]) {
      expect(degustationCompleteSchema.safeParse({ vinId: VIN, note: v }).success).toBe(false);
    }
  });

  it("refuse un prix négatif, et une unité inventée", () => {
    expect(degustationCompleteSchema.safeParse({ vinId: VIN, prixPaye: -1 }).success).toBe(false);
    expect(degustationCompleteSchema.safeParse({ vinId: VIN, prixUnite: "magnum" }).success).toBe(false);
  });

  it("refuse un lieu hors de la liste du design", () => {
    expect(degustationCompleteSchema.safeParse({ vinId: VIN, lieuType: "maison" }).success).toBe(true);
    expect(degustationCompleteSchema.safeParse({ vinId: VIN, lieuType: "bateau" }).success).toBe(false);
  });
});

describe("correctionAnalyseSchema", () => {
  it("accepte une chaîne vide : c'est ainsi qu'on EFFACE une valeur inventée", () => {
    const r = correctionAnalyseSchema.parse({ vinId: VIN, millesime: "", degre: "", domaine: "" });
    expect(r.millesime).toBe("");
    expect(r.degre).toBe("");
    expect(r.domaine).toBe("");
  });

  it("refuse un millésime ou un degré aberrant", () => {
    expect(correctionAnalyseSchema.safeParse({ vinId: VIN, millesime: 1500 }).success).toBe(false);
    expect(correctionAnalyseSchema.safeParse({ vinId: VIN, degre: 90 }).success).toBe(false);
  });
});
