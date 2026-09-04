import { describe, it, expect } from "vitest";
import { calculerCaveStats, type DegustationStat, type VinStat } from "./caveStats";

const vin = (p: Partial<VinStat>): VinStat =>
  ({ id: "v", couleur: null, region: null, cepages: [], prix_estime: null, ...p });
const deg = (p: Partial<DegustationStat>): DegustationStat =>
  ({ vin_id: "v", note: null, prix_paye: null, prix_unite: null, deguste_le: "2026-09-01", ...p });

const LE_JOUR = new Date("2026-09-04T10:00:00Z");
const stats = (vins: VinStat[], degustations: DegustationStat[]) =>
  calculerCaveStats({ vins, degustations }, LE_JOUR);

describe("totaux", () => {
  it("compte les vins, les dégustations, et la note moyenne en verres", () => {
    const s = stats([vin({ id: "a" }), vin({ id: "b" })], [
      deg({ vin_id: "a", note: 4 }),
      deg({ vin_id: "a", note: 3.5 }),
      deg({ vin_id: "b", note: null }),
    ]);
    expect(s.nbVins).toBe(2);
    expect(s.nbDegustations).toBe(3);
    expect(s.noteMoyenne).toBe(3.8);
  });

  it("une cave jamais notée n'affiche pas une moyenne de zéro", () => {
    expect(stats([vin({})], [deg({ note: null })]).noteMoyenne).toBeNull();
  });
});

describe("répartition par couleur", () => {
  it("compte les VINS et non les dégustations : une bouteille bue dix fois reste une bouteille", () => {
    const s = stats(
      [vin({ id: "r", couleur: "rouge" }), vin({ id: "b", couleur: "blanc" })],
      [deg({ vin_id: "r" }), deg({ vin_id: "r" }), deg({ vin_id: "r" }), deg({ vin_id: "b" })],
    );
    expect(s.couleurs).toEqual([
      { couleur: "rouge", nb: 1, part: 50 },
      { couleur: "blanc", nb: 1, part: 50 },
    ]);
  });

  it("les parts tombent sur 100 % même quand les arrondis ne tombent pas juste", () => {
    const s = stats(
      [
        vin({ id: "1", couleur: "rouge" }), vin({ id: "2", couleur: "rouge" }),
        vin({ id: "3", couleur: "blanc" }), vin({ id: "4", couleur: "rose" }),
      ].concat([vin({ id: "5", couleur: "rouge" })]),
      [],
    );
    expect(s.couleurs.reduce((somme, c) => somme + c.part, 0)).toBe(100);
    expect(s.couleurs.map((c) => c.part)).toEqual([60, 20, 20]);
  });

  it("un vin sans couleur ne fabrique pas une part fantôme", () => {
    const s = stats([vin({ id: "1", couleur: "rouge" }), vin({ id: "2" })], []);
    expect(s.couleurs).toEqual([{ couleur: "rouge", nb: 1, part: 100 }]);
  });
});

describe("régions et cépages", () => {
  it("classe les régions par nombre de vins, avec la note moyenne de ce qui y a été bu", () => {
    const s = stats(
      [
        vin({ id: "p1", region: "Provence" }), vin({ id: "p2", region: "Provence" }),
        vin({ id: "b1", region: "Bourgogne" }),
      ],
      [deg({ vin_id: "p1", note: 4 }), deg({ vin_id: "p2", note: 4.5 }), deg({ vin_id: "b1", note: 5 })],
    );
    expect(s.regions).toEqual([
      { region: "Provence", nb: 2, note_moyenne: 4.3 },
      { region: "Bourgogne", nb: 1, note_moyenne: 5 },
    ]);
  });

  it("un vin à plusieurs cépages compte pour chacun d'eux", () => {
    const s = stats([vin({ id: "v", cepages: ["Grenache", "Cinsault"] })], [deg({ vin_id: "v", note: 4 })]);
    expect(s.cepages).toEqual([
      { cepage: "Cinsault", nb: 1, note_moyenne: 4 },
      { cepage: "Grenache", nb: 1, note_moyenne: 4 },
    ]);
  });

  it("ne garde que les premières entrées : une liste de trente régions n'est plus une statistique", () => {
    const vins = Array.from({ length: 8 }, (_, i) => vin({ id: `v${i}`, region: `R${i}` }));
    expect(stats(vins, []).regions).toHaveLength(4);
  });
});

describe("dépense", () => {
  it("additionne tout ce qui a été payé, verres compris", () => {
    const s = stats([vin({})], [
      deg({ prix_paye: 45, prix_unite: "bouteille" }),
      deg({ prix_paye: 12, prix_unite: "verre" }),
    ]);
    expect(s.depense.totalPaye).toBe(57);
  });

  it("ne compare au prix caviste que les BOUTEILLES dont le vin a un prix estimé", () => {
    const s = stats(
      [vin({ id: "estime", prix_estime: 28 }), vin({ id: "inconnu" })],
      [
        deg({ vin_id: "estime", prix_paye: 60, prix_unite: "bouteille" }),
        deg({ vin_id: "estime", prix_paye: 14, prix_unite: "verre" }),
        deg({ vin_id: "inconnu", prix_paye: 90, prix_unite: "bouteille" }),
      ],
    );
    expect(s.depense.bouteilles).toEqual({ nb: 1, paye: 60, estime: 28 });
  });

  it("sans une seule bouteille comparable, il n'y a pas de comparaison à afficher", () => {
    const s = stats([vin({ prix_estime: 28 })], [deg({ prix_paye: 14, prix_unite: "verre" })]);
    expect(s.depense.bouteilles).toBeNull();
  });

  it("étale la dépense sur les six derniers mois, du plus ancien au mois courant", () => {
    const s = stats([vin({})], [
      deg({ prix_paye: 30, deguste_le: "2026-09-02" }),
      deg({ prix_paye: 20, deguste_le: "2026-09-30" }),
      deg({ prix_paye: 50, deguste_le: "2026-07-15" }),
      deg({ prix_paye: 999, deguste_le: "2026-01-15" }),
    ]);
    expect(s.depense.mois).toEqual([
      { mois: "2026-04", montant: 0 },
      { mois: "2026-05", montant: 0 },
      { mois: "2026-06", montant: 0 },
      { mois: "2026-07", montant: 50 },
      { mois: "2026-08", montant: 0 },
      { mois: "2026-09", montant: 50 },
    ]);
  });

  it("passe l'année sans trébucher : décembre précède janvier", () => {
    const s = calculerCaveStats(
      { vins: [vin({})], degustations: [deg({ prix_paye: 40, deguste_le: "2025-12-20" })] },
      new Date("2026-02-10T10:00:00Z"),
    );
    expect(s.depense.mois.map((m) => m.mois)).toEqual(
      ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"],
    );
    expect(s.depense.mois.find((m) => m.mois === "2025-12")?.montant).toBe(40);
  });
});
