import { describe, it, expect } from "vitest";
import { isPremiumFrom } from "./premium";

const now = new Date("2026-06-22T00:00:00Z");

describe("isPremiumFrom", () => {
  it("null -> false", () => expect(isPremiumFrom(null, now)).toBe(false));
  it("active -> true (même si period_end passé)", () =>
    expect(isPremiumFrom({ status: "active", currentPeriodEnd: "2026-01-01T00:00:00Z" }, now)).toBe(true));
  it("canceled avant expiry -> true", () =>
    expect(isPremiumFrom({ status: "canceled", currentPeriodEnd: "2026-12-31T00:00:00Z" }, now)).toBe(true));
  it("canceled après expiry -> false", () =>
    expect(isPremiumFrom({ status: "canceled", currentPeriodEnd: "2026-01-01T00:00:00Z" }, now)).toBe(false));
});
