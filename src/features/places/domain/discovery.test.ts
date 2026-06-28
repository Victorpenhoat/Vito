import { describe, it, expect } from "vitest";
import { searchEnvies, markOwned, addRecent, removeRecent } from "./discovery";
import type { Place } from "./filterPlaces";
import type { PlaceSummary } from "@/lib/services/places/types";

const place = (placeId: string | null): Place => ({
  id: placeId ?? "x",
  statut: "a_faire",
  is_favorite: false,
  reco_source: null,
  etablissement: { id: "e", nom: "X", type: null, ville: null, arrondissement: null, categorie: "resto", photo_ref: null, lat: null, lng: null, place_id: placeId, rating: null, rating_count: null },
  tags: [],
});
const sum = (placeId: string, nom: string): PlaceSummary => ({ placeId, nom, adresse: null });

describe("searchEnvies", () => {
  it("resto → 4 envies avec query non vide", () => {
    const e = searchEnvies("resto");
    expect(e).toHaveLength(4);
    expect(e.every((x) => x.query.trim().length > 0 && x.labelKey.length > 0)).toBe(true);
  });
  it("hotel → 4 envies (query/labelKey non vides)", () => {
    const e = searchEnvies("hotel");
    expect(e).toHaveLength(4);
    expect(e.every((x) => x.query.trim().length > 0 && x.labelKey.length > 0)).toBe(true);
  });
});

describe("markOwned", () => {
  it("marque possédé par place_id, ordre préservé", () => {
    const places = [place("p1")];
    const res = markOwned([sum("p1", "A"), sum("p2", "B")], places);
    expect(res.map((r) => [r.result.placeId, r.owned])).toEqual([["p1", true], ["p2", false]]);
  });
});

describe("addRecent", () => {
  it("ajoute en tête", () => expect(addRecent(["a"], "b")).toEqual(["b", "a"]));
  it("déduplique et remonte en tête", () => expect(addRecent(["a", "b"], "b")).toEqual(["b", "a"]));
  it("plafonne à max", () => expect(addRecent(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]));
  it("requête vide → inchangé", () => expect(addRecent(["a"], "  ")).toEqual(["a"]));
});

describe("removeRecent", () => {
  it("retire l'entrée", () => expect(removeRecent(["a", "b"], "a")).toEqual(["b"]));
  it("absente → inchangé", () => expect(removeRecent(["a"], "z")).toEqual(["a"]));
});
