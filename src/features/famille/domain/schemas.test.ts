import { describe, it, expect } from "vitest";
import { familleInputSchema, inviteSchema } from "./schemas";

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
