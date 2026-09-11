import { describe, it, expect } from "vitest";
import { initials, toneClasses } from "./helpers";

describe("initials", () => {
  it("prénom + nom → 2 initiales majuscules", () => expect(initials("Victor Penhoat")).toBe("VP"));
  it("nom simple → 1 initiale", () => expect(initials("Victor")).toBe("V"));
  it("espaces multiples gérés", () => expect(initials("  jean   dupont ")).toBe("JD"));
  it("vide → fallback", () => expect(initials("")).toBe("?"));
});

describe("toneClasses", () => {
  it("mappe chaque tone", () => {
    expect(toneClasses("green")).toBe("bg-kpi-green/10 border-kpi-green/24");
    expect(toneClasses("violet")).toBe("bg-kpi-violet/10 border-kpi-violet/24");
  });
});
