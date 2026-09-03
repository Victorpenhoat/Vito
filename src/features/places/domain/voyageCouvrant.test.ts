import { describe, expect, it } from "vitest";
import { voyagesCouvrant, type VoyageLite } from "./voyageCouvrant";

const V: VoyageLite[] = [
  { id: "rome", titre: "Week-end à Rome", date_debut: "2026-09-12", date_fin: "2026-09-15" },
  { id: "ete", titre: "Été en Provence", date_debut: "2026-07-01", date_fin: "2026-08-31" },
  { id: "juil", titre: "Cap Ferret", date_debut: "2026-07-10", date_fin: "2026-07-20" },
  { id: "sansdates", titre: "Idée Lisbonne", date_debut: null, date_fin: null },
];

describe("voyagesCouvrant", () => {
  it("retourne le voyage qui englobe la plage (bornes incluses)", () => {
    expect(voyagesCouvrant(V, "2026-09-12", "2026-09-15").map((v) => v.id)).toEqual(["rome"]);
  });
  it("exclut un voyage qui ne couvre pas tout le séjour", () => {
    expect(voyagesCouvrant(V, "2026-09-12", "2026-09-20")).toEqual([]);
  });
  it("teste la seule arrivée quand le départ manque", () => {
    expect(voyagesCouvrant(V, "2026-07-15").map((v) => v.id)).toEqual(["juil", "ete"]);
  });
  it("trie du début le plus récent au plus ancien", () => {
    expect(voyagesCouvrant(V, "2026-07-12", "2026-07-18").map((v) => v.id)).toEqual(["juil", "ete"]);
  });
  it("ignore les voyages sans dates et retourne [] sans arrivée", () => {
    expect(voyagesCouvrant(V, "2026-01-01")).toEqual([]);
    expect(voyagesCouvrant(V, null)).toEqual([]);
    expect(voyagesCouvrant(V, "")).toEqual([]);
  });
  it("tolère un départ antérieur à l'arrivée (retombe sur l'arrivée seule)", () => {
    expect(voyagesCouvrant(V, "2026-09-14", "2026-09-10").map((v) => v.id)).toEqual(["rome"]);
  });
});
