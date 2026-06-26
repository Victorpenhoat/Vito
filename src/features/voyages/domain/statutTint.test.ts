import { describe, it, expect } from "vitest";
import { statutTint } from "./statutTint";

describe("statutTint", () => {
  it("dégradé spécifique pour un statut connu", () => {
    expect(statutTint("confirme")).toContain("#2f5a3f");
  });
  it("fallback neutre (tokens) pour null/inconnu", () => {
    expect(statutTint(null)).toContain("--hero-from");
    expect(statutTint("zzz")).toContain("--hero-from");
  });
});
