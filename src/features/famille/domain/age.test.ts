import { describe, expect, it } from "vitest";
import { ageYears } from "./age";

const now = new Date(Date.UTC(2026, 8, 2)); // 2026-09-02

describe("ageYears", () => {
  it("âge révolu après l'anniversaire de l'année", () => {
    expect(ageYears("2017-03-14", now)).toBe(9);
  });
  it("âge non révolu avant l'anniversaire de l'année", () => {
    expect(ageYears("2019-10-21", now)).toBe(6);
  });
  it("jour d'anniversaire = âge révolu", () => {
    expect(ageYears("2019-09-02", now)).toBe(7);
  });
  it("null si absent ou invalide", () => {
    expect(ageYears(null, now)).toBeNull();
    expect(ageYears("n/a", now)).toBeNull();
  });
  it("null si date future", () => {
    expect(ageYears("2027-01-01", now)).toBeNull();
  });
});
