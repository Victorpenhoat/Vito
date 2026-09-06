import { describe, it, expect } from "vitest";
import { elementsDuJour, resumeJour } from "./programmeJournee";
import type { Etape } from "./programme";
import type { EtapeProgramme, ReservationProgramme } from "./programmeJournee";

const etape = (p: Partial<Etape> & { categorie?: string | null; moment?: string | null }): EtapeProgramme =>
  ({ id: "e", jour: "2026-10-12", heure: null, titre: "Étape", lieu: null, etablissementId: null,
     notes: null, ordre: 0, categorie: null, moment: null, ...p });

const resa = (p: Partial<ReservationProgramme>): ReservationProgramme =>
  ({ id: "r", type: "vol", libelle: "AF 1204", dateDebut: "2026-10-12", dateFin: null,
     heure: "07:40", resume: "CDG → FCO", ...p });

describe("elementsDuJour", () => {
  it("mêle les étapes saisies et les réservations du jour, à l'heure dite", () => {
    const el = elementsDuJour("2026-10-12",
      [etape({ id: "dej", heure: "13:00", titre: "Da Enzo" })],
      [resa({})]);
    expect(el.map((x) => x.cle)).toEqual(["resa-r", "etape-dej"]);
  });

  it("une réservation d'un autre jour n'apparaît pas", () => {
    expect(elementsDuJour("2026-10-13", [], [resa({})])).toEqual([]);
  });

  it("une réservation à cheval (hôtel) apparaît chaque jour du séjour", () => {
    const hotel = resa({ id: "h", type: "hotel", dateDebut: "2026-10-12", dateFin: "2026-10-15", heure: null });
    expect(elementsDuJour("2026-10-14", [], [hotel]).map((x) => x.cle)).toEqual(["resa-h"]);
  });

  it("ce qui a une heure passe avant ce qui n'en a pas", () => {
    const el = elementsDuJour("2026-10-12",
      [etape({ id: "soir", moment: "soir", titre: "Gelato" }), etape({ id: "matin", heure: "09:00" })],
      []);
    expect(el.map((x) => x.cle)).toEqual(["etape-matin", "etape-soir"]);
  });

  it("les moments s'ordonnent dans la journée, pas alphabétiquement", () => {
    const el = elementsDuJour("2026-10-12", [
      etape({ id: "soir", moment: "soir" }),
      etape({ id: "matin", moment: "matin" }),
      etape({ id: "midi", moment: "midi" }),
    ], []);
    expect(el.map((x) => x.cle)).toEqual(["etape-matin", "etape-midi", "etape-soir"]);
  });

  it("une réservation ne se modifie pas depuis le programme : elle y est en lecture", () => {
    const el = elementsDuJour("2026-10-12", [], [resa({})]);
    expect(el[0]?.source).toBe("reservation");
    expect(el[0]?.etape).toBeUndefined();
  });
});

describe("resumeJour", () => {
  const jours = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"];

  it("nomme l'arrivée et le retour, comme la maquette", () => {
    expect(resumeJour("2026-10-12", jours, [], [])).toEqual({ cle: "arrivee" });
    expect(resumeJour("2026-10-15", jours, [], [])).toEqual({ cle: "retour" });
  });

  it("compte les étapes d'une journée remplie", () => {
    const etapes = [etape({ id: "a" }), etape({ id: "b" }), etape({ id: "c" })];
    expect(resumeJour("2026-10-13", jours, etapes.map((e) => ({ ...e, jour: "2026-10-13" })), []))
      .toEqual({ cle: "etapes", n: 3 });
  });

  it("dit « libre » quand rien n'est prévu", () => {
    expect(resumeJour("2026-10-14", jours, [], [])).toEqual({ cle: "libre" });
  });

  it("une réservation suffit à occuper une journée", () => {
    expect(resumeJour("2026-10-14", jours, [], [resa({ dateDebut: "2026-10-14" })]))
      .toEqual({ cle: "etapes", n: 1 });
  });

  it("un voyage d'un seul jour est une arrivée, pas un retour", () => {
    expect(resumeJour("2026-10-12", ["2026-10-12"], [], [])).toEqual({ cle: "arrivee" });
  });
});
