import { describe, it, expect } from "vitest";
import { formatDay, formatRange } from "./date";

describe("formatDay", () => {
  it("nul → vide", () => expect(formatDay(null, "fr-FR")).toBe(""));
  it("ISO → contient le jour", () => expect(formatDay("2026-09-12", "fr-FR")).toContain("12"));
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
