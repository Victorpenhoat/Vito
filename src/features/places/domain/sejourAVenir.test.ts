import { describe, it, expect } from "vitest";
import {
  etatReservation, sejourDejaEnregistre, basculeProposee,
  type ReservationHebergement, type SejourEnregistre,
} from "./sejourAVenir";

const AUJOURDHUI = "2026-10-14";
const resa = (p: Partial<ReservationHebergement>): ReservationHebergement => ({
  id: "r1", voyageId: "v1", voyageTitre: "Rome", dateDebut: "2026-10-12", dateFin: "2026-10-15", ...p,
});

describe("etatReservation", () => {
  it("distingue à venir, en cours et passée", () => {
    expect(etatReservation(resa({ dateDebut: "2026-10-20", dateFin: "2026-10-22" }), AUJOURDHUI)).toBe("a_venir");
    expect(etatReservation(resa({}), AUJOURDHUI)).toBe("en_cours");
    expect(etatReservation(resa({ dateDebut: "2026-10-01", dateFin: "2026-10-05" }), AUJOURDHUI)).toBe("passee");
  });

  it("le jour du départ, on est encore dedans", () => {
    expect(etatReservation(resa({ dateDebut: "2026-10-10", dateFin: AUJOURDHUI }), AUJOURDHUI)).toBe("en_cours");
  });

  it("une réservation d'un seul jour se juge sur son arrivée", () => {
    expect(etatReservation(resa({ dateDebut: AUJOURDHUI, dateFin: null }), AUJOURDHUI)).toBe("en_cours");
    expect(etatReservation(resa({ dateDebut: "2026-10-13", dateFin: null }), AUJOURDHUI)).toBe("passee");
  });

  it("sans date, il n'y a rien à situer dans le temps", () => {
    expect(etatReservation(resa({ dateDebut: null, dateFin: null }), AUJOURDHUI)).toBe("sans_dates");
  });
});

describe("sejourDejaEnregistre", () => {
  const sejour = (visiteLe: string, dateFin: string | null = null): SejourEnregistre => ({ visite_le: visiteLe, date_fin: dateFin });

  it("reconnaît le séjour saisi sur les mêmes dates", () => {
    expect(sejourDejaEnregistre(resa({}), [sejour("2026-10-12", "2026-10-15")])).toBe(true);
  });

  it("un séjour qui chevauche la réservation compte : les dates saisies à la main dérivent d'un jour", () => {
    expect(sejourDejaEnregistre(resa({}), [sejour("2026-10-13", "2026-10-16")])).toBe(true);
  });

  it("un séjour d'un autre mois ne compte pas pour celui-là", () => {
    expect(sejourDejaEnregistre(resa({}), [sejour("2026-08-01", "2026-08-04")])).toBe(false);
  });

  it("sans séjour du tout, rien n'est enregistré", () => {
    expect(sejourDejaEnregistre(resa({}), [])).toBe(false);
  });

  it("une réservation sans dates ne peut être rapprochée d'aucun séjour", () => {
    expect(sejourDejaEnregistre(resa({ dateDebut: null, dateFin: null }), [sejour("2026-10-12")])).toBe(false);
  });
});

describe("basculeProposee", () => {
  it("propose d'enregistrer le séjour une fois la réservation passée", () => {
    expect(basculeProposee(resa({ dateDebut: "2026-10-01", dateFin: "2026-10-05" }), [], AUJOURDHUI)).toBe(true);
  });

  it("ne propose rien pendant le séjour ni avant : on n'y est pas encore allé", () => {
    expect(basculeProposee(resa({}), [], AUJOURDHUI)).toBe(false);
    expect(basculeProposee(resa({ dateDebut: "2026-11-01", dateFin: "2026-11-03" }), [], AUJOURDHUI)).toBe(false);
  });

  it("ne propose pas deux fois : un séjour déjà saisi clôt la question", () => {
    const passee = resa({ dateDebut: "2026-10-01", dateFin: "2026-10-05" });
    expect(basculeProposee(passee, [{ visite_le: "2026-10-01", date_fin: "2026-10-05" }], AUJOURDHUI)).toBe(false);
  });

  it("une réservation sans dates ne propose rien : il n'y aurait rien à préremplir", () => {
    expect(basculeProposee(resa({ dateDebut: null, dateFin: null }), [], AUJOURDHUI)).toBe(false);
  });
});
