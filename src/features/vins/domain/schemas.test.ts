import { describe, it, expect } from "vitest";
import { degustationInputSchema } from "./schemas";

const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("degustationInputSchema", () => {
  it("accepte une saisie minimale (juste le nom)", () => {
    expect(degustationInputSchema.safeParse({ nom: "Mon Vin", cepages: [] }).success).toBe(true);
  });
  it("rejette une couleur invalide", () => {
    expect(degustationInputSchema.safeParse({ nom: "V", couleur: "violet", cepages: [] }).success).toBe(false);
  });
  it("accepte les demi-verres et arrondit au demi le plus proche", () => {
    expect(degustationInputSchema.parse({ nom: "V", note: 4.5, cepages: [] }).note).toBe(4.5);
    expect(degustationInputSchema.parse({ nom: "V", note: 4.3, cepages: [] }).note).toBe(4.5);
    expect(degustationInputSchema.parse({ nom: "V", note: 4.1, cepages: [] }).note).toBe(4);
  });

  it("rejette une note hors plage", () => {
    expect(degustationInputSchema.safeParse({ nom: "V", note: 6, cepages: [] }).success).toBe(false);
    expect(degustationInputSchema.safeParse({ nom: "V", note: 0, cepages: [] }).success).toBe(false);
  });
  it("rejette un prix négatif", () => {
    expect(degustationInputSchema.safeParse({ nom: "V", prixPaye: -1, cepages: [] }).success).toBe(false);
  });
  it("accepte un etablissementId uuid valide", () => {
    expect(degustationInputSchema.safeParse({ nom: "V", etablissementId: UUID, cepages: [] }).success).toBe(true);
  });
});

