import { describe, it, expect } from "vitest";
import { participantMoi, maPart, porteeDepense, parPersonne } from "./depensesResume";
import type { DepenseVoyage } from "./depensesVoyage";

const MOI = "p-moi";
const AUTRE = "p-autre";
const depense = (p: Partial<DepenseVoyage>): DepenseVoyage =>
  ({ id: "d", payePar: MOI, montantCents: 3000, parts: [], ...p });

describe("participantMoi", () => {
  const participants = [
    { id: MOI, profileId: "u1" },
    { id: AUTRE, profileId: "u2" },
    { id: "p-enfant", profileId: null },
  ];

  it("me reconnaît par mon compte", () => {
    expect(participantMoi(participants, "u1")?.id).toBe(MOI);
  });

  it("si je ne suis pas du voyage, il n'y a pas de « ma part » à afficher", () => {
    expect(participantMoi(participants, "u-inconnu")).toBeNull();
  });

  it("un voyageur sans compte n'est jamais « moi »", () => {
    expect(participantMoi(participants, null)).toBeNull();
  });
});

describe("maPart", () => {
  it("additionne mes parts, quelles que soient les dépenses", () => {
    const depenses = [
      depense({ parts: [{ participantId: MOI, partCents: 1500 }, { participantId: AUTRE, partCents: 1500 }] }),
      depense({ id: "d2", parts: [{ participantId: MOI, partCents: 800 }] }),
    ];
    expect(maPart(depenses, MOI)).toBe(2300);
  });

  it("une dépense qui ne me concerne pas ne compte pas", () => {
    expect(maPart([depense({ parts: [{ participantId: AUTRE, partCents: 3000 }] })], MOI)).toBe(0);
  });

  it("sans participant identifié, il n'y a pas de part", () => {
    expect(maPart([depense({ parts: [{ participantId: MOI, partCents: 10 }] })], null)).toBe(0);
  });
});

describe("porteeDepense", () => {
  it("dit « tous » quand chaque voyageur partage", () => {
    const d = depense({ parts: [{ participantId: MOI, partCents: 1 }, { participantId: AUTRE, partCents: 1 }] });
    expect(porteeDepense(d, 2)).toEqual({ tous: true, nb: 2 });
  });

  it("compte les concernés quand ils ne sont pas tous là", () => {
    const d = depense({ parts: [{ participantId: MOI, partCents: 1 }] });
    expect(porteeDepense(d, 3)).toEqual({ tous: false, nb: 1 });
  });

  it("une part à zéro reste une part : elle concerne quand même la personne", () => {
    const d = depense({ parts: [{ participantId: MOI, partCents: 0 }, { participantId: AUTRE, partCents: 2 }] });
    expect(porteeDepense(d, 2)).toEqual({ tous: true, nb: 2 });
  });
});

describe("parPersonne", () => {
  it("annonce le montant par tête, arrondi au centime", () => {
    expect(parPersonne(8650, 4)).toBe(2163); // 86,50 € / 4 = 21,63 €
  });

  it("sans personne à qui répartir, il n'y a rien à annoncer", () => {
    expect(parPersonne(1000, 0)).toBeNull();
  });
});
