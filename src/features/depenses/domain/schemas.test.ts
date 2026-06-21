import { describe, it, expect } from "vitest";
import { groupeInputSchema, depenseInputSchema, remboursementInputSchema, shareGroupeSchema } from "./schemas";

const A = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const B = "b1ffc88a-1c2b-4ef8-bb6d-6bb9bd380a22";

describe("groupeInputSchema", () => {
  it("titre requis ; voyageId optionnel uuid", () => {
    expect(groupeInputSchema.safeParse({ titre: "Rome" }).success).toBe(true);
    expect(groupeInputSchema.safeParse({}).success).toBe(false);
    expect(groupeInputSchema.safeParse({ titre: "X", voyageId: "nope" }).success).toBe(false);
  });
});

describe("depenseInputSchema", () => {
  it("accepte une dépense égale valide (montant euros -> cents)", () => {
    const r = depenseInputSchema.safeParse({
      groupeId: A, payePar: A, libelle: "Hôtel", montantCents: "30", mode: "egal", participants: [A, B],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.montantCents).toBe(3000);
  });
  it("rejette participants vide, mode invalide, montant nul", () => {
    expect(depenseInputSchema.safeParse({ groupeId: A, payePar: A, libelle: "X", montantCents: "10", mode: "egal", participants: [] }).success).toBe(false);
    expect(depenseInputSchema.safeParse({ groupeId: A, payePar: A, libelle: "X", montantCents: "10", mode: "parts", participants: [A] }).success).toBe(false);
    expect(depenseInputSchema.safeParse({ groupeId: A, payePar: A, libelle: "X", montantCents: "0", mode: "egal", participants: [A] }).success).toBe(false);
  });
});

describe("remboursementInputSchema", () => {
  it("de != vers, montant > 0", () => {
    expect(remboursementInputSchema.safeParse({ groupeId: A, deProfileId: A, versProfileId: B, montantCents: "20" }).success).toBe(true);
    expect(remboursementInputSchema.safeParse({ groupeId: A, deProfileId: A, versProfileId: A, montantCents: "20" }).success).toBe(false);
  });
});

describe("shareGroupeSchema", () => {
  it("email valide requis", () => {
    expect(shareGroupeSchema.safeParse({ groupeId: A, email: "a@b.fr" }).success).toBe(true);
    expect(shareGroupeSchema.safeParse({ groupeId: A, email: "nope" }).success).toBe(false);
  });
});
