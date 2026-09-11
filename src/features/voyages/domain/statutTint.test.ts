import { describe, it, expect } from "vitest";
import { statutTint } from "./statutTint";

describe("statutTint", () => {
  it("dégradé spécifique pour un statut connu", () => {
    expect(statutTint("confirme")).toContain("#174436");
    expect(statutTint("planifie")).toContain("#1B2B4A");
    expect(statutTint("en_preparation")).toContain("#1B2B4A");
    expect(statutTint("idee")).toContain("#2B3348");
    expect(statutTint("en_cours")).toContain("#4A3A1A");
    expect(statutTint("termine")).toContain("#242C3A");
  });
  it("fallback neutre (tokens) pour null/inconnu", () => {
    expect(statutTint(null)).toContain("--hero-from");
    expect(statutTint("zzz")).toContain("--hero-from");
  });
});
