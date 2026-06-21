import { describe, it, expect } from "vitest";
import { centsFromEuros, formatCents } from "./money";

describe("centsFromEuros", () => {
  it("convertit virgule et point en centimes", () => {
    expect(centsFromEuros.parse("12,50")).toBe(1250);
    expect(centsFromEuros.parse("12.5")).toBe(1250);
    expect(centsFromEuros.parse("12")).toBe(1200);
  });
  it("rejette 0, négatif, >2 décimales et non-numérique", () => {
    expect(centsFromEuros.safeParse("0").success).toBe(false);
    expect(centsFromEuros.safeParse("-1").success).toBe(false);
    expect(centsFromEuros.safeParse("12.555").success).toBe(false);
    expect(centsFromEuros.safeParse("abc").success).toBe(false);
  });
});

describe("formatCents", () => {
  it("formate en devise avec 2 décimales et virgule", () => {
    expect(formatCents(1250, "EUR")).toBe("12,50 EUR");
    expect(formatCents(7000, "EUR")).toBe("70,00 EUR");
    expect(formatCents(0, "EUR")).toBe("0,00 EUR");
  });
});
