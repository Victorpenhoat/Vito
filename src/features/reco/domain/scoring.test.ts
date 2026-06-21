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
  it("score budget : price_level proche du tier budget > price_level éloigné", () => {
    // budgetMax=40 => tier 2 ; price_level 2 est pile, price_level 4 est à distance 2
    const proche = scoreEtablissement(
      { type: null, arrondissement: null, price_level: 2 },
      { typesPreferes: [], zones: [], budgetMax: 40 },
      noImplicit,
    );
    const loin = scoreEtablissement(
      { type: null, arrondissement: null, price_level: 4 },
      { typesPreferes: [], zones: [], budgetMax: 40 },
      noImplicit,
    );
    expect(proche).toBeGreaterThan(loin);
  });
});
