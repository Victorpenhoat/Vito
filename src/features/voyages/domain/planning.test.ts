import { describe, it, expect } from "vitest";
import { fenetreDepuis, barrePour, chevauche, periodesDeLaFenetre, vacancesDuVoyage, type Periode } from "./planning";

const FENETRE = { debut: "2026-09-01", fin: "2026-09-30" }; // 30 jours, pour des pourcentages lisibles
const vac = (p: Partial<Periode>): Periode =>
  ({ id: "v", libelle: "Toussaint", debut: "2026-10-17", fin: "2026-11-02", ...p });

describe("fenetreDepuis", () => {
  it("déroule douze mois à partir du mois en cours, du 1er au dernier jour", () => {
    const f = fenetreDepuis(new Date("2026-09-04T00:00:00Z"), 12);
    expect(f.debut).toBe("2026-09-01");
    expect(f.fin).toBe("2027-08-31");
    expect(f.mois).toHaveLength(12);
    expect(f.mois[0]).toMatchObject({ annee: 2026, mois: 9 });
    expect(f.mois.at(-1)).toMatchObject({ annee: 2027, mois: 8 });
  });

  it("chaque mois porte ses propres bornes", () => {
    const f = fenetreDepuis(new Date("2026-01-15T00:00:00Z"), 2);
    expect(f.mois[0]).toMatchObject({ debut: "2026-01-01", fin: "2026-01-31" });
    expect(f.mois[1]).toMatchObject({ debut: "2026-02-01", fin: "2026-02-28" });
  });
});

describe("barrePour", () => {
  it("place une période à sa juste largeur", () => {
    // du 11 au 20 septembre : 10 jours sur 30
    const barre = barrePour("2026-09-11", "2026-09-20", FENETRE);
    expect(barre?.gauchePct).toBeCloseTo((10 / 30) * 100, 5);
    expect(barre?.largeurPct).toBeCloseTo((10 / 30) * 100, 5);
  });

  it("une période qui déborde est rognée aux bords de la fenêtre, pas rejetée", () => {
    const barre = barrePour("2026-08-20", "2026-09-05", FENETRE);
    expect(barre?.gauchePct).toBe(0);
    expect(barre?.largeurPct).toBeCloseTo((5 / 30) * 100, 5);
  });

  it("une période entièrement hors fenêtre n'a pas de place sur la frise", () => {
    expect(barrePour("2026-07-01", "2026-07-10", FENETRE)).toBeNull();
    expect(barrePour("2027-01-01", "2027-01-10", FENETRE)).toBeNull();
  });

  it("un voyage d'un seul jour reste visible : il ne fait pas zéro", () => {
    const barre = barrePour("2026-09-10", null, FENETRE);
    expect(barre?.largeurPct).toBeGreaterThan(0);
  });

  it("sans date de départ, il n'y a rien à placer", () => {
    expect(barrePour(null, "2026-09-10", FENETRE)).toBeNull();
    expect(barrePour(null, null, FENETRE)).toBeNull();
  });

  it("une date de retour antérieure au départ ne dessine pas une barre à l'envers", () => {
    const barre = barrePour("2026-09-20", "2026-09-10", FENETRE);
    expect(barre?.largeurPct).toBeGreaterThan(0);
    expect(barre?.gauchePct).toBeCloseTo((19 / 30) * 100, 5);
  });
});

describe("chevauche", () => {
  it("deux périodes qui se touchent se chevauchent", () => {
    expect(chevauche({ debut: "2026-09-01", fin: "2026-09-10" }, { debut: "2026-09-10", fin: "2026-09-20" })).toBe(true);
  });

  it("deux périodes disjointes ne se chevauchent pas", () => {
    expect(chevauche({ debut: "2026-09-01", fin: "2026-09-09" }, { debut: "2026-09-10", fin: "2026-09-20" })).toBe(false);
  });
});

describe("periodesDeLaFenetre", () => {
  it("ne garde que les vacances visibles sur la frise", () => {
    const periodes = [vac({ id: "dedans", debut: "2026-09-05", fin: "2026-09-08" }), vac({ id: "dehors", debut: "2027-02-01", fin: "2027-02-10" })];
    expect(periodesDeLaFenetre(periodes, FENETRE).map((p) => p.id)).toEqual(["dedans"]);
  });
});

describe("vacancesDuVoyage", () => {
  const periodes = [
    vac({ id: "toussaint", libelle: "Toussaint", debut: "2026-10-17", fin: "2026-11-02" }),
    vac({ id: "noel", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" }),
  ];

  it("dit sur quelles vacances tombe un voyage", () => {
    expect(vacancesDuVoyage({ debut: "2026-10-20", fin: "2026-10-25" }, periodes).map((p) => p.id))
      .toEqual(["toussaint"]);
  });

  it("un voyage à cheval sur deux périodes les nomme toutes les deux", () => {
    expect(vacancesDuVoyage({ debut: "2026-10-30", fin: "2026-12-20" }, periodes)).toHaveLength(2);
  });

  it("un voyage hors vacances ne s'invente pas de correspondance", () => {
    expect(vacancesDuVoyage({ debut: "2026-09-10", fin: "2026-09-12" }, periodes)).toEqual([]);
  });

  it("un voyage sans dates ne tombe sur rien", () => {
    expect(vacancesDuVoyage({ debut: null, fin: null }, periodes)).toEqual([]);
  });
});
