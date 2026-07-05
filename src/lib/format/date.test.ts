import { describe, it, expect } from "vitest";
import { formatDay, formatRange } from "./date";

describe("formatDay", () => {
  it("nul → vide", () => expect(formatDay(null, "fr-FR")).toBe(""));
  it("ISO → contient le jour", () => expect(formatDay("2026-09-12", "fr-FR")).toContain("12"));
  // Régression fuseau (audit 04/07) : une date-only doit rendre le jour calendaire STOCKÉ,
  // pas J-1. Sous un fuseau à l'ouest d'UTC, l'ancien code affichait « 11 » pour « …-12 ».
  it("rend le jour stocké, pas J-1 (indépendant du fuseau)", () => {
    const s = formatDay("2026-09-12", "fr-FR");
    expect(s).toMatch(/\b12\b/);
    expect(s).not.toMatch(/\b11\b/);
  });
  it("ne décale pas au premier du mois", () => {
    expect(formatDay("2026-01-01", "fr-FR")).toMatch(/\b1\b/);
  });
});
describe("formatRange", () => {
  it("deux bornes → jointes par tiret", () => {
    const r = formatRange("2026-09-12", "2026-09-18", "fr-FR");
    expect(r).toContain("12");
    expect(r).toContain("18");
    expect(r).toContain(" – ");
  });
  it("une seule borne → pas de tiret", () => {
    expect(formatRange("2026-09-12", null, "fr-FR")).not.toContain(" – ");
  });
  it("aucune borne → vide", () => expect(formatRange(null, null, "fr-FR")).toBe(""));
});
