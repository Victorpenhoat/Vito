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

// Régression fuseau (audit 04/07) : un document expirant AUJOURD'HUI est valable toute
// la journée d'échéance — pas « expired » dès minuit passé. On compare des jours
// calendaires (UTC), pas un jour vs un instant.
describe("expiryStatus — échéance du jour", () => {
  it("expire aujourd'hui à midi → pas encore expired", () => {
    expect(expiryStatus("2026-06-27", new Date("2026-06-27T12:00:00Z"))).not.toBe("expired");
  });
  it("expiré hier → expired", () => {
    expect(expiryStatus("2026-06-26", new Date("2026-06-27T12:00:00Z"))).toBe("expired");
  });
});
