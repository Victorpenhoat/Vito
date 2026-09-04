import { describe, it, expect } from "vitest";
import {
  partsEgales, soldesParticipants, transfertsSimplifies, totalDepenses,
  type DepenseVoyage,
} from "./depensesVoyage";

// Trois voyageurs, dont un SANS COMPTE : c'est tout l'objet du lot — un enfant
// ou un ami sans compte doit sa part comme les autres.
const VICTOR = "p-victor";
const CAMILLE = "p-camille";
const LEA_SANS_COMPTE = "p-lea";
const TOUS = [VICTOR, CAMILLE, LEA_SANS_COMPTE];

const depense = (p: Partial<DepenseVoyage>): DepenseVoyage =>
  ({ id: "d", payePar: VICTOR, montantCents: 3000, parts: [], ...p });

describe("partsEgales", () => {
  it("répartit à parts égales", () => {
    expect(partsEgales(3000, [VICTOR, CAMILLE])).toEqual([
      { participantId: CAMILLE, partCents: 1500 },
      { participantId: VICTOR, partCents: 1500 },
    ]);
  });

  it("ne perd pas le centime qui ne tombe pas juste", () => {
    const parts = partsEgales(1000, TOUS);
    expect(parts.reduce((s, p) => s + p.partCents, 0)).toBe(1000);
    expect(parts.map((p) => p.partCents).sort()).toEqual([333, 333, 334]);
  });

  it("sans personne à qui répartir, il n'y a pas de parts", () => {
    expect(partsEgales(1000, [])).toEqual([]);
  });
});

describe("soldesParticipants", () => {
  it("celui qui paie pour tous est créditeur du reste", () => {
    const soldes = soldesParticipants(TOUS, [
      depense({ payePar: VICTOR, montantCents: 3000, parts: partsEgales(3000, TOUS) }),
    ], []);
    expect(soldes.find((s) => s.participantId === VICTOR)?.soldeCents).toBe(2000);
    expect(soldes.find((s) => s.participantId === LEA_SANS_COMPTE)?.soldeCents).toBe(-1000);
  });

  it("un voyageur qui n'a ni payé ni consommé est à zéro, pas absent", () => {
    const soldes = soldesParticipants(TOUS, [
      depense({ payePar: VICTOR, montantCents: 2000, parts: partsEgales(2000, [VICTOR, CAMILLE]) }),
    ], []);
    expect(soldes.find((s) => s.participantId === LEA_SANS_COMPTE)?.soldeCents).toBe(0);
  });

  it("un remboursement solde la dette", () => {
    const depenses = [depense({ payePar: VICTOR, montantCents: 2000, parts: partsEgales(2000, [VICTOR, CAMILLE]) })];
    const soldes = soldesParticipants(TOUS, depenses,
      [{ deParticipantId: CAMILLE, versParticipantId: VICTOR, montantCents: 1000 }]);
    expect(soldes.every((s) => s.soldeCents === 0)).toBe(true);
  });

  it("la somme des soldes est toujours nulle : rien ne se crée ni ne se perd", () => {
    const soldes = soldesParticipants(TOUS, [
      depense({ payePar: CAMILLE, montantCents: 1000, parts: partsEgales(1000, TOUS) }),
      depense({ payePar: LEA_SANS_COMPTE, montantCents: 4501, parts: partsEgales(4501, TOUS) }),
    ], []);
    expect(soldes.reduce((s, x) => s + x.soldeCents, 0)).toBe(0);
  });
});

describe("transfertsSimplifies", () => {
  it("dit qui doit quoi à qui, sans détour", () => {
    const soldes = soldesParticipants(TOUS, [
      depense({ payePar: VICTOR, montantCents: 3000, parts: partsEgales(3000, TOUS) }),
    ], []);
    const transferts = transfertsSimplifies(soldes);
    expect(transferts).toHaveLength(2);
    expect(transferts.every((t) => t.versParticipantId === VICTOR && t.montantCents === 1000)).toBe(true);
  });

  it("des comptes équilibrés ne demandent aucun transfert", () => {
    expect(transfertsSimplifies([
      { participantId: VICTOR, soldeCents: 0 },
      { participantId: CAMILLE, soldeCents: 0 },
    ])).toEqual([]);
  });
});

describe("totalDepenses", () => {
  it("additionne ce que le voyage a coûté", () => {
    expect(totalDepenses([depense({ montantCents: 1500 }), depense({ montantCents: 2500 })])).toBe(4000);
  });

  it("un voyage sans dépense n'a rien coûté", () => {
    expect(totalDepenses([])).toBe(0);
  });
});
