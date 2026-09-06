import { describe, it, expect } from "vitest";
import { VACANCES_ZONE_C, ZONE_SCOLAIRE } from "./vacancesScolaires";

// Ce calendrier se ressaisit à la main chaque rentrée. Ces vérifications ne
// disent pas que les dates sont les BONNES — seule la source officielle le dit
// — mais qu'elles se tiennent : une coquille de frappe (mois inversé, année
// oubliée, période à l'envers) fausserait tout ce que l'écran propose.
describe("vacances scolaires zone C", () => {
  it("annonce la zone du PO", () => {
    expect(ZONE_SCOLAIRE).toBe("C");
  });

  it("chaque période a des dates ISO, et se termine après avoir commencé", () => {
    for (const p of VACANCES_ZONE_C) {
      expect(p.debut).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.fin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.fin >= p.debut).toBe(true);
      expect(p.libelle.trim()).not.toBe("");
    }
  });

  it("les périodes se suivent sans se chevaucher ni se répéter", () => {
    const ids = VACANCES_ZONE_C.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < VACANCES_ZONE_C.length; i++) {
      expect(VACANCES_ZONE_C[i]!.debut > VACANCES_ZONE_C[i - 1]!.fin).toBe(true);
    }
  });

  it("couvre l'année scolaire annoncée, de la Toussaint au printemps", () => {
    expect(VACANCES_ZONE_C.map((p) => p.libelle)).toEqual(["Toussaint", "Noël", "Hiver", "Printemps"]);
  });
});
