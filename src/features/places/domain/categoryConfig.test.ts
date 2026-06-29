import { describe, it, expect } from "vitest";
import { computeNotation, chipsForVariant, categoryConfig } from "./categoryConfig";

describe("computeNotation", () => {
  it("resto → étoiles /5 avec la valeur brute", () => {
    expect(computeNotation("resto", 4.6)).toEqual({ kind: "stars", value: 4.6, scale: 5 });
  });
  it("hôtel → score /10 = rating × 2", () => {
    expect(computeNotation("hotel", 4.5)).toEqual({ kind: "score", value: 9, scale: 10 });
    expect(computeNotation("hotel", 5)).toEqual({ kind: "score", value: 10, scale: 10 });
    expect(computeNotation("hotel", 3.3)).toEqual({ kind: "score", value: 6.6, scale: 10 });
  });
  it("rating null → null (resto et hôtel)", () => {
    expect(computeNotation("resto", null)).toBeNull();
    expect(computeNotation("hotel", null)).toBeNull();
  });
  it("rating 0 → note rendue (valeur 0), pas null", () => {
    expect(computeNotation("resto", 0)).toEqual({ kind: "stars", value: 0, scale: 5 });
    expect(computeNotation("hotel", 0)).toEqual({ kind: "score", value: 0, scale: 10 });
  });
});

describe("chipsForVariant", () => {
  const tags = ["a", "b", "c"];
  it("liste → max 2", () => expect(chipsForVariant(tags, "resto", "liste")).toEqual(["a", "b"]));
  it("vignette → max 1", () => expect(chipsForVariant(tags, "resto", "vignette")).toEqual(["a"]));
  it("hôtel vignette → max 1 (au-dessus du max)", () => expect(chipsForVariant(tags, "hotel", "vignette")).toEqual(["a"]));
  it("moins de tags que le max → tous", () => expect(chipsForVariant(["a"], "hotel", "liste")).toEqual(["a"]));
});

describe("categoryConfig", () => {
  it("resto = étoiles + descripteur cuisine, classe étoiles non rendue", () => {
    expect(categoryConfig.resto.notationKind).toBe("stars");
    expect(categoryConfig.resto.descriptor).toBe("cuisine");
    expect(categoryConfig.resto.showStarClass).toBe(false);
  });
  it("hôtel = score + descripteur ambiance, classe étoiles non rendue (→ Slice 7)", () => {
    expect(categoryConfig.hotel.notationKind).toBe("score");
    expect(categoryConfig.hotel.descriptor).toBe("ambiance");
    expect(categoryConfig.hotel.showStarClass).toBe(false);
  });
  it("listTagFilter : resto false, hôtel true", () => {
    expect(categoryConfig.resto.listTagFilter).toBe(false);
    expect(categoryConfig.hotel.listTagFilter).toBe(true);
  });
});
