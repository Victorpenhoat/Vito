import { describe, it, expect } from "vitest";
import { tagsForMap, filterByTag } from "./mapFilters";
import type { Place } from "./filterPlaces";

const mk = (id: string, tags: { slug: string; label: string }[]): Place => ({
  id,
  statut: "a_faire",
  is_favorite: false,
  reco_source: null,
  etablissement: { id, nom: id, type: null, ville: null, arrondissement: null, categorie: "resto", photo_ref: null, lat: null, lng: null, place_id: null, rating: null, rating_count: null },
  tags: tags.map((t) => ({ ...t, color: null })),
});

describe("tagsForMap", () => {
  it("déduplique par slug et trie par label", () => {
    const places = [
      mk("a", [{ slug: "terrasse", label: "Terrasse" }, { slug: "business", label: "Business" }]),
      mk("b", [{ slug: "terrasse", label: "Terrasse" }]),
    ];
    expect(tagsForMap(places)).toEqual([
      { slug: "business", label: "Business" },
      { slug: "terrasse", label: "Terrasse" },
    ]);
  });
  it("liste vide si aucun tag", () => {
    expect(tagsForMap([mk("a", [])])).toEqual([]);
  });
});

describe("filterByTag", () => {
  const places = [
    mk("a", [{ slug: "terrasse", label: "Terrasse" }]),
    mk("b", []),
  ];
  it("slug null → toutes les places", () => {
    expect(filterByTag(places, null).map((p) => p.id)).toEqual(["a", "b"]);
  });
  it("slug donné → uniquement celles portant ce slug", () => {
    expect(filterByTag(places, "terrasse").map((p) => p.id)).toEqual(["a"]);
  });
});
