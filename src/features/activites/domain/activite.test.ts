import { describe, it, expect } from "vitest";
import { prochaineOccurrence, seancesRestantes, jourIso, type Creneau } from "./activite";

const creneau = (p: Partial<Creneau>): Creneau =>
  ({ id: "c", jourSemaine: 6, heureDebut: "10:00", heureFin: "11:00", ...p });

describe("jourIso", () => {
  it("compte du lundi au dimanche, comme le calendrier", () => {
    // 7 septembre 2026 = lundi
    expect(jourIso("2026-09-07")).toBe(1);
    expect(jourIso("2026-09-12")).toBe(6);
    expect(jourIso("2026-09-13")).toBe(7);
  });
});

describe("prochaineOccurrence", () => {
  // Lundi 7 septembre 2026.
  const lundi = "2026-09-07";

  it("trouve le prochain samedi pour un cours du samedi", () => {
    expect(prochaineOccurrence([creneau({})], lundi))
      .toEqual({ date: "2026-09-12", heureDebut: "10:00", creneauId: "c" });
  });

  it("le cours d'aujourd'hui compte tant qu'il n'a pas commencé", () => {
    const auj = prochaineOccurrence([creneau({ jourSemaine: 1 })], lundi, "09:00");
    expect(auj?.date).toBe(lundi);
  });

  it("mais plus une fois l'heure passée : on regarde la semaine suivante", () => {
    const apres = prochaineOccurrence([creneau({ jourSemaine: 1 })], lundi, "10:30");
    expect(apres?.date).toBe("2026-09-14");
  });

  it("entre deux créneaux, retient le plus proche", () => {
    const res = prochaineOccurrence(
      [creneau({ id: "sam", jourSemaine: 6 }), creneau({ id: "mer", jourSemaine: 3, heureDebut: "14:00" })],
      lundi,
    );
    expect(res).toMatchObject({ creneauId: "mer", date: "2026-09-09" });
  });

  it("à égalité de jour, retient l'heure la plus tôt", () => {
    const res = prochaineOccurrence(
      [creneau({ id: "tard", jourSemaine: 3, heureDebut: "18:00" }),
       creneau({ id: "tot", jourSemaine: 3, heureDebut: "14:00" })],
      lundi,
    );
    expect(res?.creneauId).toBe("tot");
  });

  it("ignore un créneau hors de sa période de validité", () => {
    // Le cours ne reprend qu'en octobre : rien à annoncer cette semaine.
    expect(prochaineOccurrence([creneau({ valideDu: "2026-10-01" })], lundi)).toBeNull();
    // Et un cours terminé en juin n'a plus d'occurrence.
    expect(prochaineOccurrence([creneau({ valideAu: "2026-06-30" })], lundi)).toBeNull();
  });

  it("une activité sans créneau n'a rien à annoncer", () => {
    expect(prochaineOccurrence([], lundi)).toBeNull();
  });
});

describe("seancesRestantes", () => {
  it("décompte une formule à la carte", () => {
    expect(seancesRestantes(20, 13)).toBe(7);
  });

  it("une séance manquée est consommée — c'est ce qui rend le décompte utile", () => {
    // 12 faites + 1 manquée = 13 consommées sur 20.
    expect(seancesRestantes(20, 12 + 1)).toBe(7);
  });

  it("ne descend jamais sous zéro", () => {
    expect(seancesRestantes(20, 25)).toBe(0);
  });

  it("un abonnement illimité n'a rien à décompter — et surtout pas zéro", () => {
    expect(seancesRestantes(null, 13)).toBeNull();
    expect(seancesRestantes(undefined, 0)).toBeNull();
  });
});
