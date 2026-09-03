import { describe, it, expect } from "vitest";
import { filtrerCave, trierParDerniereDegustation, facettesCave, SEUIL_COUP_DE_COEUR, type VinCave } from "./caveFilters";

const vin = (p: Partial<VinCave>): VinCave => ({
  id: "x", nom: "Vin", domaine: null, appellation: null, region: null, couleur: null,
  millesime: null, cepages: [], note_moyenne: null, nb_degustations: 0,
  dernier_lieu: null, derniere_date: null, a_retrouver: false, a_etiquette: false, prix_max: null,
  ...p,
});

describe("filtrerCave", () => {
  it("coups de cœur : au seuil, on est dedans", () => {
    const cave = [
      vin({ id: "pile", note_moyenne: SEUIL_COUP_DE_COEUR }),
      vin({ id: "dessous", note_moyenne: SEUIL_COUP_DE_COEUR - 0.5 }),
    ];
    expect(filtrerCave(cave, { onglet: "coups_de_coeur" }).map((v) => v.id)).toEqual(["pile"]);
  });

  it("un vin jamais noté n'est pas un coup de cœur", () => {
    expect(filtrerCave([vin({ note_moyenne: null })], { onglet: "coups_de_coeur" })).toHaveLength(0);
  });

  it("À retrouver ne garde que les vins marqués", () => {
    const cave = [vin({ id: "oui", a_retrouver: true }), vin({ id: "non" })];
    expect(filtrerCave(cave, { onglet: "a_retrouver" }).map((v) => v.id)).toEqual(["oui"]);
  });

  it("la recherche ignore accents et casse, et couvre domaine/appellation/cépage", () => {
    const cave = [vin({ id: "t", domaine: "Domaine Tempier", appellation: "Bandol", cepages: ["Mourvèdre"] })];
    for (const q of ["tempier", "BANDOL", "mourvedre"]) {
      expect(filtrerCave(cave, { q }).map((v) => v.id)).toEqual(["t"]);
    }
    expect(filtrerCave(cave, { q: "chablis" })).toHaveLength(0);
  });

  it("le prix filtre sur le maximum payé, et laisse passer un vin sans prix connu", () => {
    const cave = [vin({ id: "cher", prix_max: 80 }), vin({ id: "sobre", prix_max: 20 }), vin({ id: "inconnu" })];
    expect(filtrerCave(cave, { prixMax: 30 }).map((v) => v.id)).toEqual(["sobre", "inconnu"]);
  });

  it("cumule les facettes", () => {
    const cave = [
      vin({ id: "ok", couleur: "rouge", region: "Provence", note_moyenne: 4.5 }),
      vin({ id: "couleur", couleur: "blanc", region: "Provence", note_moyenne: 4.5 }),
      vin({ id: "note", couleur: "rouge", region: "Provence", note_moyenne: 2 }),
    ];
    expect(filtrerCave(cave, { couleur: "rouge", region: "provence", noteMin: 4 }).map((v) => v.id)).toEqual(["ok"]);
  });
});

describe("trierParDerniereDegustation", () => {
  it("met la dégustation la plus récente en tête, et n'altère pas l'entrée", () => {
    const cave = [vin({ id: "vieux", derniere_date: "2025-01-02" }), vin({ id: "recent", derniere_date: "2026-08-01" })];
    expect(trierParDerniereDegustation(cave).map((v) => v.id)).toEqual(["recent", "vieux"]);
    expect(cave.map((v) => v.id)).toEqual(["vieux", "recent"]);
  });

  it("relègue les vins jamais dégustés", () => {
    const cave = [vin({ id: "jamais" }), vin({ id: "bu", derniere_date: "2025-01-02" })];
    expect(trierParDerniereDegustation(cave).map((v) => v.id)).toEqual(["bu", "jamais"]);
  });
});

describe("facettesCave", () => {
  it("déduplique et trie ce qui alimente les menus", () => {
    const cave = [
      vin({ couleur: "rouge", region: "Provence", cepages: ["Mourvèdre", "Grenache"] }),
      vin({ couleur: "rouge", region: "Bourgogne", cepages: ["Grenache"] }),
    ];
    expect(facettesCave(cave)).toEqual({
      couleurs: ["rouge"],
      regions: ["Bourgogne", "Provence"],
      cepages: ["Grenache", "Mourvèdre"],
    });
  });
});
