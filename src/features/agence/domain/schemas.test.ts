import { describe, it, expect } from "vitest";
import { lierClientSchema } from "./schemas";

describe("lierClientSchema", () => {
  it("email valide requis", () => {
    expect(lierClientSchema.safeParse({ email: "a@b.fr" }).success).toBe(true);
    expect(lierClientSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});
