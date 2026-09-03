import { describe, expect, it } from "vitest";
import { displayNameDepuis, profilSchema } from "./schemas";

describe("profilSchema", () => {
  it("exige un prénom, le nom est optionnel", () => {
    expect(profilSchema.safeParse({ firstName: "Victor" }).success).toBe(true);
    expect(profilSchema.safeParse({ firstName: "Victor", lastName: "" }).success).toBe(true);
    expect(profilSchema.safeParse({ firstName: "  ", lastName: "Penhoat" }).success).toBe(false);
  });
  it("borne les longueurs", () => {
    expect(profilSchema.safeParse({ firstName: "x".repeat(81) }).success).toBe(false);
  });
  it("nettoie les espaces autour", () => {
    expect(profilSchema.parse({ firstName: "  Victor " }).firstName).toBe("Victor");
  });
});

describe("displayNameDepuis", () => {
  it("assemble prénom et nom", () => {
    expect(displayNameDepuis("Victor", "Penhoat")).toBe("Victor Penhoat");
  });
  it("tolère un nom absent ou vide", () => {
    expect(displayNameDepuis("Victor")).toBe("Victor");
    expect(displayNameDepuis("Victor", "   ")).toBe("Victor");
  });
});
