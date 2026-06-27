import { describe, it, expect } from "vitest";
import { maskDocNumber } from "./mask";
describe("maskDocNumber", () => {
  it("nul → vide", () => expect(maskDocNumber(null)).toBe(""));
  it("révèle les 3 derniers", () => expect(maskDocNumber("12AB45892")).toBe("••••••892"));
  it("≤3 → tout masqué", () => expect(maskDocNumber("12")).toBe("••"));
});
