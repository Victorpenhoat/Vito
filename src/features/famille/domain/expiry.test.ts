import { describe, it, expect } from "vitest";
import { expiryStatus, monthsUntil } from "./expiry";

const NOW = new Date("2026-06-27T00:00:00Z");

describe("expiryStatus", () => {
  it("null si pas de date", () => expect(expiryStatus(null, NOW)).toBeNull());
  it("expired si passé", () => expect(expiryStatus("2025-01-01", NOW)).toBe("expired"));
  it("soon si < 6 mois", () => expect(expiryStatus("2026-09-01", NOW)).toBe("soon"));
  it("valid si > 6 mois", () => expect(expiryStatus("2027-06-27", NOW)).toBe("valid"));
});
describe("monthsUntil", () => {
  it("compte les mois entiers restants", () => expect(monthsUntil("2026-09-27", NOW)).toBe(3));
  it("0 si déjà passé", () => expect(monthsUntil("2025-01-01", NOW)).toBe(0));
});
