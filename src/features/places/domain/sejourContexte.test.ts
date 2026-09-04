import { describe, it, expect } from "vitest";
import {
  lireContexte, contextePerime, nuits, plageApresClic, grilleMois, moisAPartirDe,
  CONTEXTE_DEFAUT, PEREMPTION_JOURS, type SejourContexte,
} from "./sejourContexte";

const ctx = (p: Partial<SejourContexte>): SejourContexte => ({ ...CONTEXTE_DEFAUT, ...p });

describe("lireContexte", () => {
  it("relit un contexte complet", () => {
    const lu = lireContexte({ arrivee: "2026-10-12", depart: "2026-10-15", adultes: 2, enfants: 2, chambres: 1, misAJourLe: "2026-09-04" });
    expect(lu).toEqual({ arrivee: "2026-10-12", depart: "2026-10-15", adultes: 2, enfants: 2, chambres: 1, misAJourLe: "2026-09-04" });
  });

  it("ce qui n'est pas du contexte revient aux valeurs par défaut", () => {
    expect(lireContexte(null)).toEqual(CONTEXTE_DEFAUT);
    expect(lireContexte("2 adultes")).toEqual(CONTEXTE_DEFAUT);
    expect(lireContexte({})).toEqual(CONTEXTE_DEFAUT);
  });

  it("une date qui n'en est pas une est jetée, pas devinée", () => {
    expect(lireContexte({ arrivee: "octobre", depart: "2026-13-45" })).toMatchObject({ arrivee: null, depart: null });
  });

  it("un départ qui ne suit pas l'arrivée ne survit pas à la relecture", () => {
    expect(lireContexte({ arrivee: "2026-10-12", depart: "2026-10-10" })).toMatchObject({
      arrivee: "2026-10-12", depart: null,
    });
  });

  it("un départ sans arrivée n'a pas de sens : il tombe", () => {
    expect(lireContexte({ depart: "2026-10-15" })).toMatchObject({ arrivee: null, depart: null });
  });

  it("les occupations aberrantes sont ramenées dans leurs bornes", () => {
    expect(lireContexte({ adultes: 0, enfants: -3, chambres: 99 })).toMatchObject({ adultes: 1, enfants: 0, chambres: 10 });
    expect(lireContexte({ adultes: "deux", chambres: 2.7 })).toMatchObject({ adultes: 2, chambres: 2 });
  });
});

describe("contextePerime", () => {
  const LE_JOUR = new Date("2026-09-04T10:00:00Z");

  it("un contexte du jour est bon à reprendre", () => {
    expect(contextePerime(ctx({ misAJourLe: "2026-09-04" }), LE_JOUR)).toBe(false);
  });

  it("passé le délai, on ne préremplit plus rien avec une intention oubliée", () => {
    expect(contextePerime(ctx({ misAJourLe: "2026-08-04" }), LE_JOUR)).toBe(true);
    expect(contextePerime(ctx({ misAJourLe: "2026-08-06" }), LE_JOUR)).toBe(false);
    expect(PEREMPTION_JOURS).toBe(30);
  });

  it("un contexte sans horodatage n'est pas repris", () => {
    expect(contextePerime(CONTEXTE_DEFAUT, LE_JOUR)).toBe(true);
  });

  it("des dates passées ne périment pas le contexte : on marque souvent un séjour au retour", () => {
    expect(contextePerime(ctx({ arrivee: "2026-08-01", depart: "2026-08-05", misAJourLe: "2026-09-03" }), LE_JOUR)).toBe(false);
  });
});

describe("nuits", () => {
  it("compte les nuits entre l'arrivée et le départ", () => {
    expect(nuits(ctx({ arrivee: "2026-10-12", depart: "2026-10-15" }))).toBe(3);
  });

  it("sans plage complète, il n'y a pas de nombre de nuits à annoncer", () => {
    expect(nuits(ctx({ arrivee: "2026-10-12" }))).toBeNull();
    expect(nuits(CONTEXTE_DEFAUT)).toBeNull();
  });
});

describe("plageApresClic", () => {
  it("le premier clic pose l'arrivée", () => {
    expect(plageApresClic({ arrivee: null, depart: null }, "2026-10-12")).toEqual({ arrivee: "2026-10-12", depart: null });
  });

  it("le second clic, plus tard, ferme la plage", () => {
    expect(plageApresClic({ arrivee: "2026-10-12", depart: null }, "2026-10-15")).toEqual({ arrivee: "2026-10-12", depart: "2026-10-15" });
  });

  it("un clic avant l'arrivée redéplace l'arrivée au lieu de créer une plage à l'envers", () => {
    expect(plageApresClic({ arrivee: "2026-10-12", depart: null }, "2026-10-08")).toEqual({ arrivee: "2026-10-08", depart: null });
  });

  it("cliquer sur l'arrivée elle-même repart de zéro plutôt que de poser une nuit fantôme", () => {
    expect(plageApresClic({ arrivee: "2026-10-12", depart: null }, "2026-10-12")).toEqual({ arrivee: "2026-10-12", depart: null });
  });

  it("une plage complète, puis un clic : on recommence une sélection", () => {
    expect(plageApresClic({ arrivee: "2026-10-12", depart: "2026-10-15" }, "2026-11-02")).toEqual({ arrivee: "2026-11-02", depart: null });
  });
});

describe("grilleMois", () => {
  it("aligne le mois sur des semaines qui commencent le lundi", () => {
    // 1er janvier 2026 = un jeudi : trois cases vides avant lui
    const semaines = grilleMois(2026, 1);
    expect(semaines[0]).toEqual([null, null, null, "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]);
    expect(semaines.every((s) => s.length === 7)).toBe(true);
  });

  it("contient tous les jours du mois, et rien d'un autre mois", () => {
    const jours = grilleMois(2026, 2).flat().filter((j): j is string => j != null);
    expect(jours).toHaveLength(28);
    expect(jours[0]).toBe("2026-02-01");
    expect(jours.at(-1)).toBe("2026-02-28");
  });

  it("un mois qui commence un lundi n'ouvre pas sur une semaine vide", () => {
    // 1er juin 2026 = un lundi
    expect(grilleMois(2026, 6)[0]?.[0]).toBe("2026-06-01");
  });
});

describe("moisAPartirDe", () => {
  it("enchaîne les mois en passant l'année", () => {
    expect(moisAPartirDe(new Date("2026-11-20T00:00:00Z"), 3)).toEqual([
      { annee: 2026, mois: 11 }, { annee: 2026, mois: 12 }, { annee: 2027, mois: 1 },
    ]);
  });
});
