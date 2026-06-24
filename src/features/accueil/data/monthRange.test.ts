import { describe, it, expect } from "vitest";
import { monthRange } from "./queries";

describe("monthRange", () => {
  it("milieu de mois", () => {
    expect(monthRange(new Date("2026-06-15T10:00:00Z"))).toEqual({ start: "2026-06-01", end: "2026-07-01" });
  });
  it("décembre → janvier suivant", () => {
    expect(monthRange(new Date("2026-12-20T00:00:00Z"))).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });
  it("1er du mois", () => {
    expect(monthRange(new Date("2026-03-01T23:00:00Z"))).toEqual({ start: "2026-03-01", end: "2026-04-01" });
  });
});
