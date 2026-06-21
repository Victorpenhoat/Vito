import { describe, it, expect } from "vitest";
import { scoreEtablissement } from "./scoring";

const noImplicit = { types: {}, zones: {} };

describe("scoreEtablissement", () => {
  it("bonus type préféré + zone préférée", () => {
    const s = scoreEtablissement(
      { type: "bistrot", arrondissement: "17e", price_level: 2 },
      { typesPreferes: ["bistrot"], zones: ["17e"], budgetMax: null },
      noImplicit,
    );
    expect(s).toBeGreaterThan(0);
  });
  it("type non préféré + zone non préférée => score plus faible", () => {
    const haut = scoreEtablissement({ type: "bistrot", arrondissement: "17e", price_level: 2 },
      { typesPreferes: ["bistrot"], zones: ["17e"], budgetMax: null }, noImplicit);
    const bas = scoreEtablissement({ type: "étoilé", arrondissement: "1er", price_level: 2 },
      { typesPreferes: ["bistrot"], zones: ["17e"], budgetMax: null }, noImplicit);
    expect(haut).toBeGreaterThan(bas);
  });
  it("les signaux implicites ajoutent au score", () => {
    const sansImplicite = scoreEtablissement({ type: "bistrot", arrondissement: "17e", price_level: 2 },
      { typesPreferes: [], zones: [], budgetMax: null }, noImplicit);
    const avecImplicite = scoreEtablissement({ type: "bistrot", arrondissement: "17e", price_level: 2 },
      { typesPreferes: [], zones: [], budgetMax: null }, { types: { bistrot: 3 }, zones: { "17e": 2 } });
    expect(avecImplicite).toBeGreaterThan(sansImplicite);
  });
});
