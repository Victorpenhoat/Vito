import { describe, it, expect } from "vitest";
import {
  joursDeLaSemaine, semaineVoisine, occurrencesDuJour, conflitsDuJour, signauxDuJour,
  type ActiviteSemaine, type Occurrence,
} from "./semaine";

const alexia = { id: "m-a", prenom: "Alexia", couleur: null };
const tom = { id: "m-t", prenom: "Tom", couleur: null };

const activite = (p: Partial<ActiviteSemaine>): ActiviteSemaine => ({
  id: "a", nom: "Équitation", clubNom: "Poney-club", statut: "en_cours", membres: [alexia],
  creneaux: [{ id: "c", jourSemaine: 6, heureDebut: "10:00", heureFin: "11:00" }],
  ...p,
});

describe("joursDeLaSemaine", () => {
  it("rend lundi → dimanche, quel que soit le jour donné", () => {
    // 9 septembre 2026 = mercredi
    expect(joursDeLaSemaine("2026-09-09")).toEqual([
      "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10",
      "2026-09-11", "2026-09-12", "2026-09-13",
    ]);
  });

  it("un dimanche appartient à la semaine qui l'a commencé", () => {
    expect(joursDeLaSemaine("2026-09-13")[0]).toBe("2026-09-07");
  });

  it("se déplace de semaine en semaine, par-dessus les mois", () => {
    expect(semaineVoisine("2026-09-28", 1)).toBe("2026-10-05");
    expect(semaineVoisine("2026-09-07", -1)).toBe("2026-08-31");
  });
});

describe("occurrencesDuJour", () => {
  const samedi = "2026-09-12";

  it("retient le créneau du bon jour de la semaine", () => {
    expect(occurrencesDuJour([activite({})], samedi)).toHaveLength(1);
    expect(occurrencesDuJour([activite({})], "2026-09-11")).toHaveLength(0);
  });

  it("une activité en pause ne remplit plus la semaine", () => {
    expect(occurrencesDuJour([activite({ statut: "en_pause" })], samedi)).toEqual([]);
    expect(occurrencesDuJour([activite({ statut: "terminee" })], samedi)).toEqual([]);
  });

  it("hors période de validité, pas de séance", () => {
    const tard = activite({ creneaux: [{ id: "c", jourSemaine: 6, heureDebut: "10:00", heureFin: "11:00", valideDu: "2026-10-01" }] });
    expect(occurrencesDuJour([tard], samedi)).toEqual([]);
  });

  it("une annulation retire la séance de ce jour-là, et de ce jour-là seulement", () => {
    const exceptions = [{ creneauId: "c", date: samedi, type: "annulation" as const }];
    expect(occurrencesDuJour([activite({})], samedi, exceptions)).toEqual([]);
    expect(occurrencesDuJour([activite({})], "2026-09-19", exceptions)).toHaveLength(1);
  });

  it("une séance ponctuelle en ajoute une là où le créneau n'en prévoyait pas", () => {
    const mardi = "2026-09-08";
    const exceptions = [{ creneauId: "c", date: mardi, type: "ponctuelle" as const, heureDebut: "17:00", heureFin: "18:00" }];
    const res = occurrencesDuJour([activite({})], mardi, exceptions);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ heureDebut: "17:00", heureFin: "18:00" });
  });

  it("classe la journée par heure de début", () => {
    const deux = [
      activite({ id: "soir", creneaux: [{ id: "s", jourSemaine: 6, heureDebut: "18:00", heureFin: "19:00" }] }),
      activite({ id: "matin", creneaux: [{ id: "m", jourSemaine: 6, heureDebut: "09:00", heureFin: "10:00" }] }),
    ];
    expect(occurrencesDuJour(deux, samedi).map((o) => o.activiteId)).toEqual(["matin", "soir"]);
  });
});

describe("conflitsDuJour", () => {
  const occ = (p: Partial<Occurrence>): Occurrence => ({
    activiteId: "a", activiteNom: "Foot", clubNom: null, creneauId: "c1",
    date: "2026-09-09", heureDebut: "14:00", heureFin: "15:00",
    membres: [tom], deposePar: null, covoiturage: false, lieuPrecision: null, ...p,
  });

  it("deux séances à la même heure pour deux enfants : il faut être à deux endroits", () => {
    const conflits = conflitsDuJour([
      occ({ creneauId: "c1", membres: [tom] }),
      occ({ creneauId: "c2", membres: [alexia], activiteNom: "Équitation" }),
    ]);
    expect(conflits).toHaveLength(1);
    expect(conflits[0]).toHaveLength(2);
  });

  it("un simple chevauchement partiel suffit — le trajet, lui, ne se coupe pas en deux", () => {
    const conflits = conflitsDuJour([
      occ({ creneauId: "c1", membres: [tom], heureDebut: "14:00", heureFin: "15:00" }),
      occ({ creneauId: "c2", membres: [alexia], heureDebut: "14:45", heureFin: "16:00" }),
    ]);
    expect(conflits).toHaveLength(1);
  });

  it("deux séances qui se suivent sans se toucher ne sont pas un conflit", () => {
    const conflits = conflitsDuJour([
      occ({ creneauId: "c1", membres: [tom], heureDebut: "14:00", heureFin: "15:00" }),
      occ({ creneauId: "c2", membres: [alexia], heureDebut: "15:00", heureFin: "16:00" }),
    ]);
    expect(conflits).toEqual([]);
  });

  it("deux séances du MÊME enfant sont une faute de saisie, pas un conflit de trajet", () => {
    const conflits = conflitsDuJour([
      occ({ creneauId: "c1", membres: [tom] }),
      occ({ creneauId: "c2", membres: [tom] }),
    ]);
    expect(conflits).toEqual([]);
  });

  it("une journée calme n'a rien à signaler", () => {
    expect(conflitsDuJour([occ({})])).toEqual([]);
    expect(conflitsDuJour([])).toEqual([]);
  });
});

describe("signauxDuJour", () => {
  const vacances = [{ id: "toussaint", libelle: "Toussaint", debut: "2026-10-17", fin: "2026-11-02" }];
  const voyages = [{ id: "v", titre: "Rome", debut: "2026-09-10", fin: "2026-09-14" }];

  it("dit les vacances scolaires du jour", () => {
    expect(signauxDuJour("2026-10-20", vacances, []).vacances?.libelle).toBe("Toussaint");
    expect(signauxDuJour("2026-09-09", vacances, []).vacances).toBeNull();
  });

  it("dit le voyage qui recouvre le jour — c'est lui qui fait manquer la séance", () => {
    expect(signauxDuJour("2026-09-12", [], voyages).voyage?.titre).toBe("Rome");
    expect(signauxDuJour("2026-09-20", [], voyages).voyage).toBeNull();
  });

  it("un voyage sans dates ne recouvre rien : c'est une envie, pas un départ", () => {
    expect(signauxDuJour("2026-09-12", [], [{ id: "x", titre: "Envie", debut: null, fin: null }]).voyage).toBeNull();
  });
});
