import { describe, expect, it } from "vitest";
import { tagSlug } from "./tagSlug";

describe("tagSlug", () => {
  it("minuscules, accents retirés, séparateurs en underscore", () => {
    expect(tagSlug("Terrasse sympa")).toBe("terrasse_sympa");
    expect(tagSlug("Coup de cœur !")).toBe("coup_de_c_ur");
    expect(tagSlug("Valeur sûre")).toBe("valeur_sure");
  });
  it("pas d'underscore en bord, longueur bornée", () => {
    expect(tagSlug("  — Date night — ")).toBe("date_night");
    expect(tagSlug("x".repeat(80)).length).toBeLessThanOrEqual(60);
  });
});
