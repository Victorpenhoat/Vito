import { describe, it, expect } from "vitest";
import { degustationInputSchema, vinFiltersSchema } from "./schemas";

const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("degustationInputSchema", () => {
  it("accepte une saisie minimale (juste le nom)", () => {
    expect(degustationInputSchema.safeParse({ nom: "Mon Vin", cepages: [] }).success).toBe(true);
  });
  it("rejette une couleur invalide", () => {
    expect(degustationInputSchema.safeParse({ nom: "V", couleur: "violet", cepages: [] }).success).toBe(false);
  });
  it("rejette une note hors plage", () => {
    expect(degustationInputSchema.safeParse({ nom: "V", note: 6, cepages: [] }).success).toBe(false);
  });
  it("rejette un prix négatif", () => {
    expect(degustationInputSchema.safeParse({ nom: "V", prixPaye: -1, cepages: [] }).success).toBe(false);
  });
  it("accepte un etablissementId uuid valide", () => {
    expect(degustationInputSchema.safeParse({ nom: "V", etablissementId: UUID, cepages: [] }).success).toBe(true);
  });
});

describe("vinFiltersSchema", () => {
  it("tout optionnel -> ok (vide)", () => {
    expect(vinFiltersSchema.safeParse({}).success).toBe(true);
  });
  it("noteMin coercé depuis une string", () => {
    const r = vinFiltersSchema.parse({ noteMin: "3" });
    expect(r.noteMin).toBe(3);
  });
});
