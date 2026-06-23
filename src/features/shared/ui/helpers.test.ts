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
    expect(toneClasses("green")).toEqual({ bg: "bg-kpi-green-bg", text: "text-kpi-green" });
    expect(toneClasses("violet")).toEqual({ bg: "bg-kpi-violet-bg", text: "text-kpi-violet" });
  });
});
