import { describe, it, expect } from "vitest";
import { familleInputSchema, inviteSchema, procheInputSchema, documentInputSchema } from "./schemas";

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

describe("documentInputSchema", () => {
  const base = { doc_type: "passeport" };
  it("accepte un type seul (champs optionnels vides)", () => {
    expect(documentInputSchema.safeParse({ ...base, doc_number: "", country: "", holder_name: "", issue_date: "", expiry_date: "", issue_place: "" }).success).toBe(true);
  });
  it("accepte des champs renseignés", () => {
    expect(documentInputSchema.safeParse({ ...base, doc_number: "12AB34567", country: "France", issue_date: "2021-03-12", expiry_date: "2031-03-11" }).success).toBe(true);
  });
  it("rejette un doc_type inconnu", () => {
    expect(documentInputSchema.safeParse({ doc_type: "carte_vitale" }).success).toBe(false);
  });
});
