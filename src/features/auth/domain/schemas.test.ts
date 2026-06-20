import { describe, it, expect } from "vitest";
import { credentialsSchema } from "./schemas";

describe("credentialsSchema", () => {
  it("rejette un email invalide", () => {
    expect(credentialsSchema.safeParse({ email: "x", password: "password123" }).success).toBe(false);
  });
  it("rejette un mot de passe trop court", () => {
    expect(credentialsSchema.safeParse({ email: "a@b.fr", password: "123" }).success).toBe(false);
  });
  it("accepte des identifiants valides", () => {
    expect(credentialsSchema.safeParse({ email: "a@b.fr", password: "password123" }).success).toBe(true);
  });
});
