import { describe, it, expect } from "vitest";
import {
  resumePresence, etatEcheance, totalRegle, totalDu, ordonnerEcheances,
  type Seance, type Paiement,
} from "./fiche";

const seances = (faites: number, manquees: number): Seance[] => [
  ...Array.from({ length: faites }, (_, i) => ({ date: `2026-06-${10 + i}`, statut: "faite" as const })),
  ...Array.from({ length: manquees }, (_, i) => ({ date: `2026-07-${10 + i}`, statut: "manquee" as const })),
];

describe("resumePresence", () => {
  it("compte comme la maquette : 12 faites, 1 manquée, 7 restantes sur 20", () => {
    expect(resumePresence(seances(12, 1), 20)).toEqual({
      faites: 12, manquees: 1, consommees: 13, restantes: 7, formule: 20,
    });
  });

  it("une séance manquée est consommée — sinon le décompte ne servirait à rien", () => {
    expect(resumePresence(seances(0, 3), 10).restantes).toBe(7);
  });

  it("un abonnement illimité ne décompte rien, et surtout pas zéro", () => {
    const r = resumePresence(seances(12, 1), null);
    expect(r.restantes).toBeNull();
    expect(r.faites).toBe(12);
  });

  it("une formule dépassée s'arrête à zéro", () => {
    expect(resumePresence(seances(25, 0), 20).restantes).toBe(0);
  });
});

describe("etatEcheance", () => {
  const auj = "2026-09-07";
  const p = (o: Partial<Paiement>): Paiement =>
    ({ id: "p", montantCents: 31_000, echeance: "2026-09-15", statut: "du", ...o });

  it("payé reste payé, même une échéance dépassée", () => {
    expect(etatEcheance(p({ statut: "paye", echeance: "2026-01-01" }), auj)).toBe("paye");
  });

  it("dû et dépassé : en retard", () => {
    expect(etatEcheance(p({ echeance: "2026-09-01" }), auj)).toBe("en_retard");
  });

  it("dû et à venir : à venir — y compris le jour même", () => {
    expect(etatEcheance(p({ echeance: "2027-01-15" }), auj)).toBe("a_venir");
    expect(etatEcheance(p({ echeance: auj }), auj)).toBe("a_venir");
  });

  it("on n'est pas en retard sur une date qu'on n'a pas fixée", () => {
    expect(etatEcheance(p({ echeance: null }), auj)).toBe("a_venir");
  });
});

describe("totaux", () => {
  const paiements: Paiement[] = [
    { id: "1", montantCents: 31_000, echeance: "2026-09-15", statut: "paye" },
    { id: "2", montantCents: 31_000, echeance: "2026-09-01", statut: "du" },
    { id: "3", montantCents: 31_000, echeance: "2027-01-15", statut: "du" },
  ];

  it("« réglé cette saison » ne compte que ce qui est payé", () => {
    expect(totalRegle(paiements)).toBe(31_000);
    expect(totalDu(paiements)).toBe(62_000);
  });

  it("sans échéance, les totaux valent zéro plutôt que NaN", () => {
    expect(totalRegle([])).toBe(0);
    expect(totalDu([])).toBe(0);
  });
});

describe("ordonnerEcheances", () => {
  it("le retard d'abord, puis ce qui vient, puis ce qui est réglé", () => {
    const auj = "2026-09-07";
    const liste: Paiement[] = [
      { id: "paye", montantCents: 1, echeance: "2026-09-15", statut: "paye" },
      { id: "avenir", montantCents: 1, echeance: "2027-01-15", statut: "du" },
      { id: "retard", montantCents: 1, echeance: "2026-09-01", statut: "du" },
    ];
    expect(ordonnerEcheances(liste, auj).map((p) => p.id)).toEqual(["retard", "avenir", "paye"]);
  });

  it("à état égal, la date la plus proche passe devant ; sans date, à la fin", () => {
    const auj = "2026-09-07";
    const liste: Paiement[] = [
      { id: "sans", montantCents: 1, echeance: null, statut: "du" },
      { id: "tard", montantCents: 1, echeance: "2027-06-01", statut: "du" },
      { id: "tot", montantCents: 1, echeance: "2026-10-01", statut: "du" },
    ];
    expect(ordonnerEcheances(liste, auj).map((p) => p.id)).toEqual(["tot", "tard", "sans"]);
  });
});
