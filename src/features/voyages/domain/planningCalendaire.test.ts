import { describe, it, expect } from "vitest";
import {
  grilleDuMois, voyagesDeLaSemaine, periodesEtLeursVoyages, moisVoisin,
  type VoyagePlanning,
} from "./planningCalendaire";
import type { Periode } from "./planning";

const voyage = (p: Partial<VoyagePlanning>): VoyagePlanning =>
  ({ id: "v", titre: "Rome", debut: "2026-10-12", fin: "2026-10-15", statut: "planifie", ...p });

describe("grilleDuMois", () => {
  it("commence au lundi et montre les jours voisins, comme la maquette (28 29 30 1 2 3 4)", () => {
    const semaines = grilleDuMois(2026, 10);
    expect(semaines[0]?.map((j) => j.numero)).toEqual([28, 29, 30, 1, 2, 3, 4]);
    expect(semaines[0]?.slice(0, 3).every((j) => j.horsMois)).toBe(true);
    expect(semaines[0]?.[3]).toMatchObject({ jour: "2026-10-01", horsMois: false });
  });

  it("chaque semaine fait sept jours, et le mois est couvert en entier", () => {
    const semaines = grilleDuMois(2026, 10);
    expect(semaines.every((s) => s.length === 7)).toBe(true);
    const duMois = semaines.flat().filter((j) => !j.horsMois);
    expect(duMois).toHaveLength(31);
    expect(duMois[0]?.jour).toBe("2026-10-01");
    expect(duMois.at(-1)?.jour).toBe("2026-10-31");
  });

  it("un mois qui commence un lundi n'ouvre pas sur une semaine de voisins", () => {
    // 1er juin 2026 = lundi
    expect(grilleDuMois(2026, 6)[0]?.[0]).toMatchObject({ jour: "2026-06-01", horsMois: false });
  });

  it("février d'une année bissextile tient dans la grille", () => {
    const duMois = grilleDuMois(2028, 2).flat().filter((j) => !j.horsMois);
    expect(duMois).toHaveLength(29);
  });
});

describe("voyagesDeLaSemaine", () => {
  const semaine = grilleDuMois(2026, 10)[2]!; // 12 → 18 octobre

  it("retient un voyage qui touche la semaine", () => {
    expect(voyagesDeLaSemaine(semaine, [voyage({})]).map((v) => v.id)).toEqual(["v"]);
  });

  it("écarte un voyage d'un autre mois", () => {
    expect(voyagesDeLaSemaine(semaine, [voyage({ debut: "2026-12-01", fin: "2026-12-05" })])).toEqual([]);
  });

  it("un voyage à cheval sur deux semaines apparaît dans les deux", () => {
    const grille = grilleDuMois(2026, 10);
    const long = voyage({ id: "long", debut: "2026-10-15", fin: "2026-10-22" });
    expect(voyagesDeLaSemaine(grille[2]!, [long]).map((v) => v.id)).toEqual(["long"]);
    expect(voyagesDeLaSemaine(grille[3]!, [long]).map((v) => v.id)).toEqual(["long"]);
  });

  it("un voyage sans dates n'a pas sa place dans une case du calendrier", () => {
    expect(voyagesDeLaSemaine(semaine, [voyage({ debut: null, fin: null })])).toEqual([]);
  });

  it("un voyage d'un seul jour compte", () => {
    expect(voyagesDeLaSemaine(semaine, [voyage({ debut: "2026-10-14", fin: null })]).map((v) => v.id))
      .toEqual(["v"]);
  });
});

describe("periodesEtLeursVoyages", () => {
  const vac = (id: string, libelle: string, debut: string, fin: string): Periode =>
    ({ id, libelle, debut, fin });
  const periodes = [
    vac("toussaint", "Toussaint", "2026-10-17", "2026-11-02"),
    vac("noel", "Noël", "2026-12-19", "2027-01-04"),
  ];

  it("associe à chaque période le voyage qui la couvre — et signale les libres", () => {
    const res = periodesEtLeursVoyages(periodes, [voyage({ id: "basque", debut: "2026-10-20", fin: "2026-10-24" })]);
    expect(res).toEqual([
      { periode: periodes[0], voyages: [expect.objectContaining({ id: "basque" })] },
      { periode: periodes[1], voyages: [] },
    ]);
  });

  it("deux voyages sur la même période sont tous deux nommés", () => {
    const res = periodesEtLeursVoyages([periodes[0]!], [
      voyage({ id: "a", debut: "2026-10-18", fin: "2026-10-20" }),
      voyage({ id: "b", debut: "2026-10-25", fin: "2026-10-28" }),
    ]);
    expect(res[0]?.voyages.map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("un voyage sans dates ne couvre aucune période : c'est une envie, pas un séjour", () => {
    const res = periodesEtLeursVoyages([periodes[0]!], [voyage({ debut: null, fin: null })]);
    expect(res[0]?.voyages).toEqual([]);
  });

  it("sans calendrier scolaire, il n'y a rien à proposer", () => {
    expect(periodesEtLeursVoyages([], [voyage({})])).toEqual([]);
  });
});

describe("moisVoisin", () => {
  it("avance et recule d'un mois, en passant l'année", () => {
    expect(moisVoisin(2026, 12, 1)).toEqual({ annee: 2027, mois: 1 });
    expect(moisVoisin(2026, 1, -1)).toEqual({ annee: 2025, mois: 12 });
  });
});
