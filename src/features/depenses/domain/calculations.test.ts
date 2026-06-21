import { describe, it, expect } from "vitest";
import { computeParts, computeBalances, simplifyDebts } from "./calculations";

const A = "aaaa", B = "bbbb", C = "cccc";

describe("computeParts", () => {
  it("égal : répartit le reste de façon déterministe (ordre profileId)", () => {
    const parts = computeParts(1000, "egal", [C, A, B]); // 1000/3 = 333 reste 1
    const byId = Object.fromEntries(parts.map((p) => [p.profileId, p.partCents]));
    expect(byId[A]).toBe(334); // premier dans l'ordre trié
    expect(byId[B]).toBe(333);
    expect(byId[C]).toBe(333);
    expect(parts.reduce((s, p) => s + p.partCents, 0)).toBe(1000);
  });
  it("exact : utilise les montants fournis si la somme correspond", () => {
    const parts = computeParts(9000, "exact", [A, B], { [A]: 5000, [B]: 4000 });
    expect(parts).toEqual([{ profileId: A, partCents: 5000 }, { profileId: B, partCents: 4000 }]);
  });
  it("exact : throw si la somme ne correspond pas", () => {
    expect(() => computeParts(9000, "exact", [A, B], { [A]: 5000, [B]: 3000 })).toThrow();
  });
  it("exact : throw si un participant n'a pas de montant", () => {
    expect(() => computeParts(9000, "exact", [A, B], { [A]: 9000 })).toThrow();
  });
});

describe("computeBalances", () => {
  it("invariant : somme des soldes = 0 ; valeurs attendues", () => {
    const balances = computeBalances(
      [A, B],
      [
        { payePar: A, parts: [{ profileId: A, partCents: 10000 }, { profileId: B, partCents: 10000 }] },
        { payePar: B, parts: [{ profileId: A, partCents: 5000 }, { profileId: B, partCents: 4000 }] },
      ],
      [{ deProfileId: A, versProfileId: B, montantCents: 2000 }],
    );
    const byId = Object.fromEntries(balances.map((b) => [b.profileId, b.soldeCents]));
    expect(byId[A]).toBe(7000);
    expect(byId[B]).toBe(-7000);
    expect(balances.reduce((s, b) => s + b.soldeCents, 0)).toBe(0);
  });
});

describe("simplifyDebts", () => {
  it("2 membres : le débiteur paie le créancier", () => {
    expect(simplifyDebts([{ profileId: A, soldeCents: 7000 }, { profileId: B, soldeCents: -7000 }]))
      .toEqual([{ deProfileId: B, versProfileId: A, montantCents: 7000 }]);
  });
  it("3 membres : total transféré = total dû, soldes nuls ignorés", () => {
    const t = simplifyDebts([
      { profileId: A, soldeCents: 6000 },
      { profileId: B, soldeCents: -4000 },
      { profileId: C, soldeCents: -2000 },
    ]);
    expect(t.reduce((s, x) => s + x.montantCents, 0)).toBe(6000);
    expect(t.every((x) => x.versProfileId === A)).toBe(true);
  });
});
