import { describe, expect, it } from "vitest";
import { voyageChip, joursAvant, nuits } from "./affichageVoyage";

const TODAY = "2026-09-02";

describe("voyageChip", () => {
  it("idee → idees, quelles que soient les dates", () => {
    expect(voyageChip("idee", null, null, TODAY)).toBe("idees");
    expect(voyageChip("idee", "2026-01-01", "2026-01-05", TODAY)).toBe("idees");
  });
  it("en_preparation et planifie (legacy) → en_preparation, même à dates passées", () => {
    expect(voyageChip("en_preparation", null, null, TODAY)).toBe("en_preparation");
    expect(voyageChip("planifie", "2026-01-01", "2026-01-05", TODAY)).toBe("en_preparation");
  });
  it("confirme futur → a_venir", () => {
    expect(voyageChip("confirme", "2026-10-12", "2026-10-15", TODAY)).toBe("a_venir");
  });
  it("confirme couvrant aujourd'hui → en_cours (dérivé)", () => {
    expect(voyageChip("confirme", "2026-09-01", "2026-09-05", TODAY)).toBe("en_cours");
  });
  it("en_cours stocké (legacy) → en_cours", () => {
    expect(voyageChip("en_cours", null, null, TODAY)).toBe("en_cours");
  });
  it("termine, ou confirme à date_fin passée → termines", () => {
    expect(voyageChip("termine", null, null, TODAY)).toBe("termines");
    expect(voyageChip("confirme", "2026-08-01", "2026-08-10", TODAY)).toBe("termines");
  });
  it("confirme sans dates → a_venir", () => {
    expect(voyageChip("confirme", null, null, TODAY)).toBe("a_venir");
  });
});

describe("joursAvant", () => {
  it("compte les jours jusqu'au départ", () => {
    expect(joursAvant("2026-09-25", TODAY)).toBe(23);
  });
  it("null si parti, aujourd'hui, ou sans date", () => {
    expect(joursAvant("2026-09-02", TODAY)).toBeNull();
    expect(joursAvant("2026-08-01", TODAY)).toBeNull();
    expect(joursAvant(null, TODAY)).toBeNull();
  });
});

describe("nuits", () => {
  it("compte les nuits", () => {
    expect(nuits("2026-10-12", "2026-10-15")).toBe(3);
  });
  it("null si incomplet ou incohérent", () => {
    expect(nuits("2026-10-12", null)).toBeNull();
    expect(nuits("2026-10-12", "2026-10-12")).toBeNull();
  });
});
