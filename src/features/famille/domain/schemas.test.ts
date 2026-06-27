import { describe, it, expect } from "vitest";
import { familleInputSchema, inviteSchema, procheInputSchema } from "./schemas";

describe("familleInputSchema", () => {
  it("nom requis, 1..120", () => {
    expect(familleInputSchema.safeParse({ nom: "Famille Martin" }).success).toBe(true);
    expect(familleInputSchema.safeParse({ nom: "" }).success).toBe(false);
    expect(familleInputSchema.safeParse({ nom: "x".repeat(121) }).success).toBe(false);
  });
});

describe("inviteSchema", () => {
  it("email valide requis", () => {
    expect(inviteSchema.safeParse({ email: "a@b.fr" }).success).toBe(true);
    expect(inviteSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("procheInputSchema", () => {
  const base = { first_name: "Camille", last_name: "Durand", relation: "ami", circle: "proche" };

  it("accepte une entrée minimale valide", () => {
    expect(procheInputSchema.safeParse(base).success).toBe(true);
  });

  it("accepte les champs optionnels vides", () => {
    const r = procheInputSchema.safeParse({ ...base, phone: "", email: "", birth_date: "" });
    expect(r.success).toBe(true);
  });

  it("accepte des champs optionnels renseignés", () => {
    const r = procheInputSchema.safeParse({ ...base, phone: "+33611223344", email: "c@ex.fr", birth_date: "1990-05-12" });
    expect(r.success).toBe(true);
  });

  it("rejette une relation inconnue", () => {
    expect(procheInputSchema.safeParse({ ...base, relation: "cousin" }).success).toBe(false);
  });

  it("rejette un cercle inconnu", () => {
    expect(procheInputSchema.safeParse({ ...base, circle: "voisins" }).success).toBe(false);
  });

  it("rejette un e-mail non vide invalide", () => {
    expect(procheInputSchema.safeParse({ ...base, email: "pas-un-email" }).success).toBe(false);
  });

  it("rejette un prénom vide", () => {
    expect(procheInputSchema.safeParse({ ...base, first_name: "" }).success).toBe(false);
  });
});
